// Variáveis globais
let webhooks = [];
const maxWebhooks = 3;

// Elementos DOM
let form, nameInput, urlInput, saveBtn, webhooksList, webhookCount;

// Inicializa elementos
function initElements() {
    form = document.getElementById('webhookForm');
    nameInput = document.getElementById('webhookName');
    urlInput = document.getElementById('webhookUrl');
    saveBtn = document.getElementById('saveBtn');
    webhooksList = document.getElementById('webhooksList');
    webhookCount = document.getElementById('webhookCount');
    
    // Adiciona span para o texto do botão
    if (saveBtn && !saveBtn.querySelector('.btn-text')) {
        saveBtn.innerHTML = '<span class="btn-text">Salvar Webhook</span>';
    }
    
    console.log('Elementos inicializados');
}

// Carrega webhooks
async function loadWebhooks() {
    try {
        const result = await chrome.storage.local.get(['webhooks']);
        webhooks = result.webhooks || [];
        console.log('Webhooks carregados:', webhooks);
        renderWebhooks();
        updateUI();
    } catch (error) {
        console.error('Erro ao carregar:', error);
    }
}

// Salva webhooks
async function saveWebhooks() {
    try {
        await chrome.storage.local.set({
            webhooks: webhooks
        });
        console.log('Webhooks salvos');
    } catch (error) {
        console.error('Erro ao salvar:', error);
    }
}

// FUNÇÃO PARA ANIMAR BOTÃO
function animateButton(type) {
    console.log('Animando botão:', type);
    
    // Remove classes anteriores
    saveBtn.classList.remove('success', 'error');
    
    // Força reflow
    saveBtn.offsetHeight;
    
    if (type === 'success') {
        saveBtn.classList.add('success');
        setTimeout(() => {
            saveBtn.classList.remove('success');
        }, 2000);
    } else if (type === 'error') {
        saveBtn.classList.add('error');
        setTimeout(() => {
            saveBtn.classList.remove('error');
        }, 2000);
    }
}

// MINI CARD DE NOTIFICAÇÃO
function showMiniToast(message, type) {
    // Remove toast anterior se existir
    const existingToast = document.querySelector('.mini-toast');
    if (existingToast) {
        existingToast.remove();
    }
    
    // Cria novo toast
    const toast = document.createElement('div');
    toast.className = `mini-toast ${type}`;
    toast.textContent = message;
    
    // Adiciona à seção webhooks
    const webhooksSection = document.querySelector('.webhooks-section');
    if (webhooksSection) {
        webhooksSection.appendChild(toast);
    } else {
        const container = document.querySelector('.container');
        container.appendChild(toast);
    }
    
    // Anima entrada
    setTimeout(() => {
        toast.classList.add('show');
    }, 10);
    
    // Remove após 3 segundos
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            if (toast.parentNode && toast.parentNode.contains(toast)) {
                toast.parentNode.removeChild(toast);
            }
        }, 400);
    }, 3000);
}

// Manipula envio do form
async function handleSave(e) {
    e.preventDefault();
    
    const name = nameInput.value.trim();
    const url = urlInput.value.trim();
    
    console.log('Tentando salvar:', { name, url, webhooksLength: webhooks.length });
    
    // Validações
    if (!name || name.length === 0) {
        animateButton('error');
        showMiniToast('❌ Digite um nome', 'error');
        nameInput.focus();
        return;
    }
    
    if (!url || url.length === 0) {
        animateButton('error');
        showMiniToast('❌ Formato inválido', 'error');
        urlInput.focus();
        return;
    }
    
    if (!isValidUrl(url)) {
        animateButton('error');
        showMiniToast('❌ Formato inválido', 'error');
        urlInput.focus();
        return;
    }
    
    if (webhooks.length >= maxWebhooks) {
        animateButton('error');
        showMiniToast('❌ Máximo 3 webhooks permitidos', 'error');
        return;
    }
    
    // Verifica se já existe webhook com mesmo nome
    if (webhooks.some(w => w.name.toLowerCase() === name.toLowerCase())) {
        animateButton('error');
        showMiniToast('❌ Nome já existe, tente outro', 'error');
        nameInput.focus();
        return;
    }
    
    const webhook = {
        id: Date.now().toString(),
        name: name,
        url: url,
        createdAt: new Date().toISOString()
    };
    
    webhooks.push(webhook);
    
    try {
        await saveWebhooks();
        
        // SUCESSO
        animateButton('success');
        showMiniToast('✅ Webhook salvo', 'success');
        
        clearForm();
        renderWebhooks();
        updateUI();
    } catch (error) {
        console.error('Erro ao salvar webhook:', error);
        webhooks.pop();
        
        animateButton('error');
        showMiniToast('❌ Erro ao salvar webhook', 'error');
    }
}

// Deleta webhook
async function deleteWebhook(id) {
    if (confirm('Excluir webhook?')) {
        webhooks = webhooks.filter(w => w.id !== id);
        
        await saveWebhooks();
        renderWebhooks();
        updateUI();
        
        showMiniToast('❌ Webhook excluído', 'error');
    }
}

// Renderiza lista de webhooks - SEM RADIO BUTTONS
function renderWebhooks() {
    if (webhooks.length === 0) {
        webhooksList.innerHTML = `
            <div class="empty-state">
                <p>Nenhum webhook configurado</p>
                <small>Configure seu primeiro webhook acima</small>
            </div>
        `;
        return;
    }
    
    webhooksList.innerHTML = webhooks.map(webhook => `
        <div class="webhook-item">
            <div class="webhook-info">
                <span class="webhook-name">${webhook.name}</span>
            </div>
            <div class="webhook-actions">
                <button class="action-btn delete-btn" data-webhook-id="${webhook.id}" 
                        title="Excluir">❌</button>
            </div>
        </div>
    `).join('');
    
    setupWebhookEventListeners();
}

// Configura event listeners para webhooks
function setupWebhookEventListeners() {
    const deleteButtons = document.querySelectorAll('.delete-btn');
    deleteButtons.forEach(button => {
        button.addEventListener('click', function() {
            deleteWebhook(this.dataset.webhookId);
        });
    });
}

// Atualiza UI
function updateUI() {
    webhookCount.textContent = `${webhooks.length}/${maxWebhooks} webhooks`;
    
    const limitReached = webhooks.length >= maxWebhooks;
    nameInput.disabled = limitReached;
    urlInput.disabled = limitReached;
    saveBtn.disabled = limitReached;
    
    const btnText = saveBtn.querySelector('.btn-text');
    if (btnText) {
        btnText.textContent = limitReached ? 'Limite Atingido' : 'Salvar Webhook';
    }
}

// Limpa form
function clearForm() {
    nameInput.value = '';
    urlInput.value = '';
    document.body.offsetHeight;
}

// Valida URL
function isValidUrl(string) {
    try {
        const url = new URL(string);
        return url.protocol === 'http:' || url.protocol === 'https:';
    } catch (_) {
        return false;
    }
}

// Função para lidar com clique no botão
function handleSaveButton(e) {
    e.preventDefault();
    e.stopPropagation();
    
    const fakeEvent = new Event('submit', { bubbles: true, cancelable: true });
    handleSave(fakeEvent);
}

// Configura os links sociais
function setupSocialLinks() {
    const linkedinLink = document.getElementById('linkedinLink');
    
    if (linkedinLink) {
        linkedinLink.addEventListener('click', function(e) {
            e.preventDefault();
            chrome.tabs.create({ url: 'https://www.linkedin.com/in/fernandosagoes/' });
        });
    }
}

window.hookShotInitialized = false;

// Inicialização
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM carregado - iniciando extensão');
    
    if (window.hookShotInitialized) {
        return;
    }
    window.hookShotInitialized = true;
    
    initElements();
    
    if (!form) {
        console.error('Formulário não encontrado!');
        return;
    }
    
    form.removeEventListener('submit', handleSave);
    form.addEventListener('submit', handleSave);
    
    if (saveBtn) {
        saveBtn.removeEventListener('click', handleSaveButton);
        saveBtn.addEventListener('click', handleSaveButton);
    }
    
    setupSocialLinks();
    
    console.log('Event listeners configurados');
    loadWebhooks();
});
