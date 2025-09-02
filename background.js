// Dados globais
let webhookData = {
    webhooks: []
};

// Flags de controle para evitar race conditions
let isLoadingWebhooks = false;
let isCreatingMenu = false;

// Carrega dados salvos com proteção contra race condition
async function loadWebhooks() {
    if (isLoadingWebhooks) {
        console.log("Background: Carregamento já em progresso, aguardando...");
        // Aguarda o carregamento atual terminar
        while (isLoadingWebhooks) {
            await new Promise(resolve => setTimeout(resolve, 50));
        }
        return;
    }
    
    isLoadingWebhooks = true;
    try {
        const result = await chrome.storage.local.get(["webhooks"]);
        webhookData.webhooks = result.webhooks || [];
        console.log("Background: Webhooks carregados:", webhookData.webhooks);
    } catch (error) {
        console.error("Erro ao carregar webhooks:", error);
    } finally {
        isLoadingWebhooks = false;
    }
}

// Cria menu contexto com proteção contra criações simultâneas
async function createContextMenu() {
    if (isCreatingMenu) {
        console.log("Background: Criação de menu já em progresso, aguardando...");
        while (isCreatingMenu) {
            await new Promise(resolve => setTimeout(resolve, 50));
        }
        return;
    }
    
    isCreatingMenu = true;
    try {
        // Remove menus existentes de forma segura
        try {
            await chrome.contextMenus.removeAll();
            // Aguarda um pouco para garantir que os menus foram removidos
            await new Promise(resolve => setTimeout(resolve, 100));
        } catch (e) {
            console.log("Erro ao remover menus (normal):", e.message);
        }
        
        if (webhookData.webhooks.length === 0) {
            console.log("Nenhum webhook, menu não criado");
            return;
        }
        
        // Cria menu principal HookShot
        chrome.contextMenus.create({
            id: "hookshot-main",
            title: "HookShot",
            contexts: ["selection"]
        });
        
        // Cria submenu para cada webhook
        webhookData.webhooks.forEach(webhook => {
            chrome.contextMenus.create({
                id: `send-to-${webhook.id}`,
                parentId: "hookshot-main",
                title: webhook.name,
                contexts: ["selection"]
            });
            console.log("Menu criado para:", webhook.name);
        });
        
    } catch (error) {
        console.error("Erro ao criar menu:", error);
    } finally {
        isCreatingMenu = false;
    }
}

// Pega webhook por ID
function getWebhookById(id) {
    return webhookData.webhooks.find(w => w.id === id);
}

// Cache para content scripts carregados
const loadedContentScripts = new Set();

// Verifica se content script está carregado com cache
async function ensureContentScript(tabId) {
    // Verifica cache primeiro
    if (loadedContentScripts.has(tabId)) {
        try {
            await chrome.tabs.sendMessage(tabId, { action: "ping" });
            return true;
        } catch (error) {
            // Remove do cache se não responder
            loadedContentScripts.delete(tabId);
        }
    }
    
    try {
        await chrome.tabs.sendMessage(tabId, { action: "ping" });
        loadedContentScripts.add(tabId);
        return true;
    } catch (error) {
        try {
            const tab = await chrome.tabs.get(tabId);
            if (!tab || tab.url.startsWith("chrome://")) {
                return false;
            }
            
            await chrome.scripting.executeScript({
                target: { tabId: tabId },
                files: ["content.js"]
            });
            
            await new Promise(resolve => setTimeout(resolve, 200));
            await chrome.tabs.sendMessage(tabId, { action: "ping" });
            loadedContentScripts.add(tabId);
            return true;
        } catch (injectError) {
            console.error("Erro ao injetar:", injectError.message);
            return false;
        }
    }
}

// Envia para webhook
async function sendToWebhook(webhook, content, tab) {
    const maxAttempts = 3;
    const baseDelay = 1000; // 1 segundo
    
    const payload = {
        webhook_name: webhook.name,
        timestamp: new Date().toISOString(),
        content: content,
        page_info: {
            url: tab.url,
            title: tab.title
        }
    };
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            console.log(`📤 Tentativa ${attempt}/${maxAttempts} - Enviando para: ${webhook.name}`);
            
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout
            
            const response = await fetch(webhook.url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (response.ok) {
                console.log(`✅ Sucesso na tentativa ${attempt} para: ${webhook.name}`);
                chrome.notifications.create({
                    type: "basic",
                    iconUrl: "icons/icon48.png",
                    title: "HookShot",
                    message: `✅ Enviado para ${webhook.name}!`
                });
                return true;
            } else {
                const errorType = getErrorType(response.status);
                console.warn(`⚠️ Tentativa ${attempt} falhou: ${response.status} - ${errorType}`);
                
                // Não retry para erros de configuração
                if (response.status === 401 || response.status === 403 || response.status === 404) {
                    console.error(`❌ Erro de configuração (${response.status}) - Parando tentativas`);
                    chrome.notifications.create({
                        type: "basic",
                        iconUrl: "icons/icon48.png",
                        title: "HookShot",
                        message: `❌ Erro de configuração: ${webhook.name} (${response.status})`
                    });
                    return false;
                }
                
                // Se não é a última tentativa, aguarda antes do próximo retry
                if (attempt < maxAttempts) {
                    const delay = baseDelay * Math.pow(2, attempt - 1); // Backoff exponencial
                    console.log(`⏳ Aguardando ${delay}ms antes da próxima tentativa...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        } catch (error) {
            const errorType = getErrorType(null, error);
            console.warn(`⚠️ Tentativa ${attempt} falhou: ${errorType}`);
            
            // Não retry para erros de abort (timeout)
            if (error.name === 'AbortError') {
                console.error(`❌ Timeout (10s) - Parando tentativas`);
                chrome.notifications.create({
                    type: "basic",
                    iconUrl: "icons/icon48.png",
                    title: "HookShot",
                    message: `❌ Timeout ao enviar para ${webhook.name}`
                });
                return false;
            }
            
            // Se não é a última tentativa, aguarda antes do próximo retry
            if (attempt < maxAttempts) {
                const delay = baseDelay * Math.pow(2, attempt - 1);
                console.log(`⏳ Aguardando ${delay}ms antes da próxima tentativa...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
    
    // Todas as tentativas falharam
    console.error(`❌ Todas as ${maxAttempts} tentativas falharam para: ${webhook.name}`);
    chrome.notifications.create({
        type: "basic",
        iconUrl: "icons/icon48.png",
        title: "HookShot",
        message: `❌ Falha total: ${webhook.name} (${maxAttempts} tentativas)`
    });
    return false;
}

// Função auxiliar para classificar tipos de erro
function getErrorType(status, error) {
    if (error) {
        if (error.name === 'AbortError') return 'Timeout';
        if (error.message.includes('network')) return 'Erro de Rede';
        return 'Erro Desconhecido';
    }
    
    if (status >= 400 && status < 500) return 'Erro do Cliente';
    if (status >= 500) return 'Erro do Servidor';
    return 'Erro HTTP';
}

// Event Listeners
chrome.storage.onChanged.addListener(async function(changes) {
    if (changes.webhooks) {
        console.log("Storage mudou, recarregando menus...");
        await loadWebhooks();
        await createContextMenu();
    }
});

// Limpa cache quando aba é fechada
chrome.tabs.onRemoved.addListener(function(tabId) {
    loadedContentScripts.delete(tabId);
});

// Limpa cache quando aba é atualizada
chrome.tabs.onUpdated.addListener(function(tabId, changeInfo) {
    if (changeInfo.status === 'loading') {
        loadedContentScripts.delete(tabId);
    }
});

chrome.contextMenus.onClicked.addListener(async function(info, tab) {
    console.log("Menu clicado:", info.menuItemId);
    
    // Verifica se é um dos nossos menus
    if (info.menuItemId.startsWith("send-to-")) {
        const webhookId = info.menuItemId.replace("send-to-", "");
        const webhook = getWebhookById(webhookId);
        
        if (!webhook) {
            console.error("Webhook não encontrado:", webhookId);
            return;
        }
        
        try {
            console.log("Capturando conteúdo para:", webhook.name);
            
            const scriptLoaded = await ensureContentScript(tab.id);
            if (!scriptLoaded) throw new Error("Script não carregado");
            
            const response = await chrome.tabs.sendMessage(tab.id, {
                action: "getSelectedContent"
            });
            
            if (response && response.content) {
                console.log("Conteúdo capturado, enviando...");
                await sendToWebhook(webhook, response.content, tab);
            } else {
                chrome.notifications.create({
                    type: "basic",
                    iconUrl: "icons/icon48.png",
                    title: "HookShot",
                    message: "❌ Nenhum conteúdo selecionado"
                });
            }
        } catch (error) {
            console.error("❌ Erro ao processar:", error);
            chrome.notifications.create({
                type: "basic",
                iconUrl: "icons/icon48.png",
                title: "HookShot",
                message: "❌ Erro ao capturar conteúdo"
            });
        }
    }
});

// Inicialização
console.log("🚀 Background script iniciando...");
loadWebhooks().then(createContextMenu);
