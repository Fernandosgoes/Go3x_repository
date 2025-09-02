# HookShot

> Envie conteúdo selecionado de qualquer página web diretamente para seus webhooks de automação

HookShot é uma extensão para Google Chrome que permite capturar texto, HTML e imagens selecionadas em páginas web e enviá-las automaticamente para serviços de automação como Make.com, Zapier, ou qualquer endpoint que aceite requisições POST.

## Funcionalidades

- **Captura Inteligente**: Texto, HTML formatado e imagens da seleção
- **Múltiplos Webhooks**: Configure até 3 webhooks diferentes
- **Menu Contextual**: Acesso rápido via clique direito
- **Sistema de Retry**: Tentativas automáticas com backoff exponencial
- **Notificações**: Feedback visual sobre status dos envios
- **Interface Limpa**: Popup moderno e intuitivo

## Instalação

### Via Chrome Web Store (Recomendado)
*Em breve disponível na Chrome Web Store*

### Instalação Manual
1. Baixe ou clone este repositório
2. Abra o Chrome e acesse `chrome://extensions/`
3. Ative o "Modo do desenvolvedor" no canto superior direito
4. Clique em "Carregar sem compactação"
5. Selecione a pasta do projeto HookShot

## Configuração Rápida

1. **Clique no ícone** da extensão na barra de ferramentas
2. **Digite um nome** para seu webhook (ex: "Pesquisa", "Arquivo")
3. **Cole a URL** do seu webhook
4. **Clique em "Salvar Webhook"**

### URLs de Webhook Suportadas
- Make.com: `https://hook.make.com/abcd1234567890`
- Zapier: `https://hooks.zapier.com/hooks/catch/123/abc`
- Webhook.site: `https://webhook.site/unique-id`
- APIs customizadas que aceitem POST com JSON

## Como Usar

1. **Selecione conteúdo** em qualquer página web
2. **Clique com o botão direito** na seleção
3. **Escolha "HookShot"** e selecione o webhook desejado
4. **Aguarde a notificação** de confirmação

## Formato dos Dados Enviados

A extensão envia um objeto JSON estruturado:

```json
{
  "webhook_name": "Nome do Webhook",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "content": {
    "text": "Texto selecionado",
    "html": "<p>HTML formatado</p>",
    "images": [
      {
        "src": "https://example.com/image.jpg",
        "alt": "Texto alternativo",
        "title": "Título da imagem",
        "width": 800,
        "height": 600
      }
    ],
    "timestamp": "2024-01-15T10:30:00.000Z",
    "url": "https://exemplo.com/pagina",
    "title": "Título da Página"
  },
  "page_info": {
    "url": "https://exemplo.com/pagina",
    "title": "Título da Página"
  }
}
```

## Estrutura do Projeto

```
hookshot/
├── manifest.json          # Configuração da extensão
├── background.js          # Service worker principal
├── content.js            # Script de captura de conteúdo
├── popup.html            # Interface de configuração
├── popup.js              # Lógica do popup
├── popup.css             # Estilos da interface
└── icons/                # Ícones da extensão
    ├── icon16.png
    ├── icon24.png
    ├── icon32.png
    ├── icon48.png
    └── icon128.png
```

## Desenvolvimento

### Pré-requisitos
- Google Chrome 88+
- Conhecimento básico de JavaScript/HTML/CSS

### Executando em Modo de Desenvolvimento

1. Clone o repositório:
```bash
git clone https://github.com/fernandosagoes/hookshot.git
cd hookshot
```

2. Carregue a extensão no Chrome:
   - Acesse `chrome://extensions/`
   - Ative "Modo do desenvolvedor"
   - Clique "Carregar sem compactação"
   - Selecione a pasta do projeto

3. Para debug, acesse:
   - **Background Script**: `chrome://extensions/` → HookShot → "service worker"
   - **Popup**: Clique direito no popup → "Inspecionar"
   - **Content Script**: F12 na página web

### Arquitetura

A extensão segue o padrão Manifest V3:

- **Background Script** (`background.js`): Gerencia webhooks, menu contextual e envios
- **Content Script** (`content.js`): Captura conteúdo das páginas web
- **Popup** (`popup.html/js/css`): Interface de configuração

### Sistema de Retry

- **3 tentativas** máximas por envio
- **Backoff exponencial**: 1s, 2s, 4s
- **Timeout**: 10 segundos por tentativa
- **Tratamento específico**:
  - Códigos 401/403/404: Para imediatamente
  - Códigos 5xx: Continua tentativas
  - Timeout/Network: Continua tentativas

## Permissões

A extensão solicita as seguintes permissões:

- `storage`: Salvar configurações de webhooks
- `contextMenus`: Criar menu de clique direito
- `activeTab`: Acessar conteúdo da aba ativa
- `scripting`: Injetar content scripts
- `notifications`: Mostrar notificações de status
- `host_permissions`: Acessar todas as URLs (HTTP/HTTPS)

## Limitações

- Máximo de 3 webhooks configurados
- Imagens base64 limitadas a 100KB
- Timeout de 10 segundos por requisição
- Não funciona em páginas `chrome://` ou outras extensões
- Algumas páginas SPA podem ter captura limitada

## Casos de Uso

### Pesquisa Acadêmica
- Coletar citações com metadados automaticamente
- Organizar referências em Notion/Airtable
- Sincronizar descobertas com Zotero

### Marketing e Análise
- Monitorar conteúdo de concorrentes
- Coletar dados de mídias sociais
- Alimentar dashboards em tempo real

### Automação de Workflow
- Integrar com ferramentas de CRM
- Salvar conteúdo em bases de conhecimento
- Disparar workflows no Make.com/Zapier

## Solução de Problemas

### Webhook não recebe dados
- Verifique se a URL está correta e ativa
- Teste o webhook com ferramentas como Postman
- Confirme que aceita requisições POST com JSON

### Menu contextual não aparece
- Certifique-se de ter conteúdo selecionado
- Recarregue a página se necessário
- Verifique se a extensão está ativa

### Erros de timeout
- Verifique sua conexão de internet
- Teste se o webhook responde rapidamente
- Considere usar um webhook local para debug

## Roadmap

- [ ] Suporte a mais tipos de arquivo
- [ ] Templates personalizáveis de payload
- [ ] Sincronização entre dispositivos
- [ ] Webhooks com autenticação
- [ ] Interface de analytics
- [ ] Suporte a Firefox

## Contribuindo

Contribuições são bem-vindas! Para contribuir:

1. Fork o projeto
2. Crie uma branch para sua feature (`git checkout -b feature/nova-funcionalidade`)
3. Commit suas mudanças (`git commit -m 'Adiciona nova funcionalidade'`)
4. Push para a branch (`git push origin feature/nova-funcionalidade`)
5. Abra um Pull Request

### Diretrizes de Contribuição

- Mantenha o código limpo e documentado
- Teste em diferentes cenários antes de submeter
- Siga os padrões de código existentes
- Atualize a documentação quando necessário

## Licença

Este projeto está licenciado sob a MIT License - veja o arquivo [LICENSE](LICENSE) para detalhes.

## Suporte

- **Issues**: [GitHub Issues](https://github.com/fernandosagoes/hookshot/issues)
- **Discussões**: [GitHub Discussions](https://github.com/fernandosagoes/hookshot/discussions)
- **Email**: fernando@sagoes.com

## Autor

**Fernando Goes**
- LinkedIn: [linkedin.com/in/fernandosagoes](https://linkedin.com/in/fernandosagoes)
- GitHub: [github.com/fernandosagoes](https://github.com/fernandosagoes)

---

Se este projeto foi útil para você, considere dar uma ⭐ no repositório!
