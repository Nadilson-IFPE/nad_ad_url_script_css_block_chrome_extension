// background.js - Service Worker para bloqueio de popups

let blockedDomains = [];
let rulesLoaded = false;

// Carrega as regras de bloqueio
async function loadBlockedDomains() {
  try {
    const response = await fetch(chrome.runtime.getURL('rules/rules_1.json'));
    const rules = await response.json();
    
    // Extrai domínios das regras existentes
    blockedDomains = [];
    rules.forEach(rule => {
      if (rule.condition && rule.condition.urlFilter) {
        // Processa urlFilter para extrair domínios
        let urlFilter = rule.condition.urlFilter;
        
        // Remove protocolos e wildcards iniciais
        urlFilter = urlFilter.replace(/^\*:\/\/\*/, '');
        urlFilter = urlFilter.replace(/^\*:\/\//, '');
        urlFilter = urlFilter.replace(/^https?:\/\//, '');
        
        // Extrai o domínio (remove paths)
        let domain = urlFilter.split('/')[0];
        
        // Remove wildcards do domínio
        domain = domain.replace(/^\*\./, '');
        domain = domain.replace(/\*$/, '');
        
        if (domain && domain.length > 0 && !blockedDomains.includes(domain)) {
          blockedDomains.push(domain);
          console.log('Domínio adicionado:', domain);
        }
      }
    });
    
    rulesLoaded = true;
    console.log('Total de domínios bloqueados carregados:', blockedDomains.length);
    console.log('Domínios:', blockedDomains);
  } catch (error) {
    console.error('Erro ao carregar regras de bloqueio:', error);
    rulesLoaded = false;
  }
}

// Verifica se uma URL deve ser bloqueada
function shouldBlockUrl(url) {
  if (!rulesLoaded || !url) return false;
  
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;
    const fullUrl = url.toLowerCase();
    
    return blockedDomains.some(domain => {
      // Verifica correspondência exata do hostname
      if (hostname === domain) {
        console.log('Bloqueio por hostname exato:', hostname, 'vs', domain);
        return true;
      }
      
      // Verifica se o hostname termina com o domínio (subdomínios)
      if (hostname.endsWith('.' + domain)) {
        console.log('Bloqueio por subdomínio:', hostname, 'vs', domain);
        return true;
      }
      
      // Verifica se o hostname contém o domínio
      if (hostname.includes(domain)) {
        console.log('Bloqueio por conteúdo:', hostname, 'vs', domain);
        return true;
      }
      
      // Verifica a URL completa (para casos com paths específicos)
      if (fullUrl.includes(domain.toLowerCase())) {
        console.log('Bloqueio por URL completa:', fullUrl, 'vs', domain);
        return true;
      }
      
      return false;
    });
  } catch (error) {
    console.error('Erro ao verificar URL:', error);
    return false;
  }
}

// Event listener para quando a extensão inicia
chrome.runtime.onStartup.addListener(() => {
  console.log('Service Worker iniciado');
  loadBlockedDomains();
});

// Event listener para quando a extensão é instalada
chrome.runtime.onInstalled.addListener(() => {
  console.log('Extensão instalada/atualizada');
  loadBlockedDomains();
});

// Intercepta tentativas de abertura de novas janelas/tabs
chrome.tabs.onCreated.addListener(async (tab) => {
  if (!rulesLoaded) {
    await loadBlockedDomains();
  }
  
  if (tab.url && shouldBlockUrl(tab.url)) {
    console.log('Popup bloqueado:', tab.url);
    
    // Remove a tab criada
    try {
      await chrome.tabs.remove(tab.id);
      
      // Notifica o content script sobre o bloqueio
      if (tab.openerTabId) {
        chrome.tabs.sendMessage(tab.openerTabId, {
          action: 'popupBlocked',
          url: tab.url
        }).catch(() => {
          // Ignora erros de mensagem (tab pode ter sido fechada)
        });
      }
    } catch (error) {
      console.error('Erro ao remover tab:', error);
    }
  }
});

// Intercepta atualizações de tabs (redirecionamentos)
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (!rulesLoaded) {
    await loadBlockedDomains();
  }
  
  if (changeInfo.url && shouldBlockUrl(changeInfo.url)) {
    console.log('Redirecionamento de popup bloqueado:', changeInfo.url);
    
    // Fecha a tab se for um popup (tem opener)
    if (tab.openerTabId) {
      try {
        await chrome.tabs.remove(tabId);
      } catch (error) {
        console.error('Erro ao remover tab de redirecionamento:', error);
      }
    }
//	chrome.tabs.goBack(tabId, () => {
//      if (chrome.runtime.lastError) {
//		  try {
//            // Se não ouver histórico para retornar, fecha a tab ou redireciona
//             await chrome.tabs.update(tabId, { url: "chrome://newtab" });
//		  } catch (error) {
//			console.error('Erro ao retornar o histórico', error);
//		  }			
      }
    });
  }
});

// Listener para mensagens do content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'checkUrl') {
    if (!rulesLoaded) {
      loadBlockedDomains().then(() => {
        sendResponse({ blocked: shouldBlockUrl(request.url) });
      });
      return true; // Indica resposta assíncrona
    } else {
      sendResponse({ blocked: shouldBlockUrl(request.url) });
    }
  } else if (request.action === 'getBlockedDomains') {
    if (!rulesLoaded) {
      loadBlockedDomains().then(() => {
        sendResponse({ domains: blockedDomains });
      });
      return true; // Indica resposta assíncrona
    } else {
      sendResponse({ domains: blockedDomains });
    }
  } else if (request.action === 'reloadRules') {
    loadBlockedDomains().then(() => {
      sendResponse({ success: true });
    });
    return true; // Indica resposta assíncrona
  }
});

// Mantém o service worker ativo
chrome.runtime.onConnect.addListener((port) => {
  console.log('Conexão estabelecida com:', port.name);
});

chrome.alarms.create('keepAlive', { periodInMinutes: 0.5 });
chrome.alarms.onAlarm.addListener(() => {
  // Mantém o ServiceWorker ativo
});

async function extensionButtonState() {
  const data = await chrome.storage.local.get(['isButtonEnabled']);
  
  // Faz nada se a extensão não estiver em execução
  if (data.isButtonEnabled === false) {
    return;
  }

  // Otherwise, run your extension's code here
  console.log("A extensão está em execução!");
}

// You can also listen for changes in real-time
chrome.storage.onChanged.forEach((changes) => {
  if (changes.isButtonEnabled) {
    console.log("Estado do botão mudou para: ", changes.isButtonEnabled.newValue);
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  chrome.storage.local.get(['isButtonEnabled'], (result) => {
    if (result.isButtonEnabled === false) {
      console.log("Service worker pausado: a extensão não está em execução.");
      return;
    }
    // Your actual logic here...
    console.log("Service worker está em execução...");
  });
});

chrome.runtime.onInstalled.addListener(({reason}) => {
  if (reason === 'install') {
 //   chrome.tabs.create({ url: "welcome.html" });
  }
});

// Carrega as regras imediatamente quando o script é executado
loadBlockedDomains();

extensionButtonState();

console.log('Service Worker inicializado');