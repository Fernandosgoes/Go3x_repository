// Content Script - Captura de Conteúdo Selecionado
console.log('📄 Content script carregado em:', window.location.href);

// Flag para evitar múltiplas inicializações
if (window.hookShotContentLoaded) {
    console.log('Content script já carregado, ignorando...');
} else {
    window.hookShotContentLoaded = true;
    initContentScript();
}

function initContentScript() {
    // Escuta mensagens do background script
    chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
        console.log('📩 Content: Mensagem recebida:', message.action);
        
        try {
            if (message.action === 'ping') {
                console.log('🏓 Ping recebido');
                sendResponse({ pong: true });
                return true;
            }
            
            if (message.action === 'getSelectedContent') {
                console.log('📝 Capturando conteúdo selecionado...');
                const content = getSelectedContent();
                console.log('✅ Content: Conteúdo capturado:', content);
                sendResponse({ content: content, success: true });
                return true;
            }
            
            sendResponse({ error: 'Ação não reconhecida', success: false });
        } catch (error) {
            console.error('❌ Erro no content script:', error);
            sendResponse({ error: error.message, success: false });
        }
        
        return true; // Mantém canal aberto para resposta assíncrona
    });
    
    console.log('✅ Content script inicializado e listening');
}

// Função principal para capturar conteúdo selecionado
function getSelectedContent() {
    const selection = window.getSelection();
    
    if (selection.rangeCount === 0) {
        console.log('❌ Content: Nenhuma seleção encontrada');
        return null;
    }
    
    const range = selection.getRangeAt(0);
    const selectedText = selection.toString().trim();
    
    if (!selectedText) {
        console.log('❌ Content: Texto selecionado vazio');
        return null;
    }
    
    console.log('📝 Content: Texto selecionado:', selectedText.substring(0, 100) + '...');
    
    try {
        // Captura HTML da seleção
        const clonedContents = range.cloneContents();
        const div = document.createElement('div');
        div.appendChild(clonedContents);
        const selectedHTML = cleanHTML(div.innerHTML);
        
        // Captura imagens dentro da seleção
        const images = getImagesInSelection(range);
        
        console.log('🎨 Content: HTML capturado');
        console.log('🖼️ Content: Imagens capturadas:', images.length);
        
        return {
            text: selectedText,
            html: selectedHTML,
            images: images,
            timestamp: new Date().toISOString(),
            url: window.location.href,
            title: document.title
        };
    } catch (error) {
        console.error('❌ Erro ao processar conteúdo:', error);
        // Retorna pelo menos o texto se der erro no HTML/imagens
        return {
            text: selectedText,
            html: selectedText,
            images: [],
            timestamp: new Date().toISOString(),
            url: window.location.href,
            title: document.title
        };
    }
}

// Captura imagens na seleção
function getImagesInSelection(range) {
    const images = [];
    
    try {
        // Clona o conteúdo para buscar imagens
        const clonedContents = range.cloneContents();
        const tempDiv = document.createElement('div');
        tempDiv.appendChild(clonedContents);
        
        // Busca todas as imagens no conteúdo clonado
        const imgElements = tempDiv.querySelectorAll('img');
        
        imgElements.forEach(function(img) {
            const imageData = extractImageData(img);
            if (imageData) {
                images.push(imageData);
            }
        });
        
        // Verifica se a seleção contém uma imagem diretamente
        const selectedNodes = getSelectedNodes(range);
        selectedNodes.forEach(function(node) {
            if (node.nodeType === Node.ELEMENT_NODE && node.tagName === 'IMG') {
                const imageData = extractImageData(node);
                if (imageData && !images.some(function(img) { return img.src === imageData.src; })) {
                    images.push(imageData);
                }
            }
        });
        
    } catch (error) {
        console.error('❌ Content: Erro ao capturar imagens:', error);
    }
    
    return images;
}

// Pega todos os nós selecionados
function getSelectedNodes(range) {
    const nodes = [];
    
    try {
        const walker = document.createTreeWalker(
            range.commonAncestorContainer,
            NodeFilter.SHOW_ALL,
            {
                acceptNode: function(node) {
                    if (range.intersectsNode && range.intersectsNode(node)) {
                        return NodeFilter.FILTER_ACCEPT;
                    }
                    return NodeFilter.FILTER_REJECT;
                }
            }
        );
        
        let node;
        while (node = walker.nextNode()) {
            nodes.push(node);
        }
    } catch (error) {
        console.error('❌ Erro ao obter nós selecionados:', error);
    }
    
    return nodes;
}

// Extrai dados da imagem
function extractImageData(imgElement) {
    try {
        const src = imgElement.src;
        const alt = imgElement.alt || '';
        const title = imgElement.title || '';
        
        // Só inclui se tem src válido
        if (!src || src === '' || src === window.location.href) {
            return null;
        }
        
        // Pula imagens base64 muito grandes (>100KB)
        if (src.startsWith('data:') && src.length > 100000) {
            console.log('🚫 Content: Imagem base64 muito grande, pulando');
            return null;
        }
        
        return {
            src: src,
            alt: alt,
            title: title,
            width: imgElement.naturalWidth || imgElement.width || 0,
            height: imgElement.naturalHeight || imgElement.height || 0
        };
    } catch (error) {
        console.error('❌ Content: Erro ao extrair dados da imagem:', error);
        return null;
    }
}

// Limpa HTML removendo scripts e atributos desnecessários
function cleanHTML(html) {
    try {
        // Cria elemento temporário para limpeza
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;
        
        // Remove scripts e estilos
        tempDiv.querySelectorAll('script, style, noscript').forEach(function(el) {
            el.remove();
        });
        
        // Remove atributos desnecessários
        const elementsToClean = tempDiv.querySelectorAll('*');
        elementsToClean.forEach(function(el) {
            // Mantém apenas atributos essenciais
            const allowedAttrs = ['href', 'src', 'alt', 'title', 'class', 'id'];
            const attrs = Array.from(el.attributes);
            
            attrs.forEach(function(attr) {
                if (!allowedAttrs.includes(attr.name.toLowerCase())) {
                    el.removeAttribute(attr.name);
                }
            });
        });
        
        return tempDiv.innerHTML;
    } catch (error) {
        console.error('❌ Content: Erro ao limpar HTML:', error);
        return html; // Retorna original se der erro
    }
}
