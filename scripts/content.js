// content.js - Content Script para bloqueio de popups

(function() {
  'use strict';

  let blockedDomains = [];
  let popupBlockedCount = 0;

  // Obtém os domínios bloqueados do service worker
  async function getBlockedDomains() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'getBlockedDomains' });
      blockedDomains = response.domains || [];
    } catch (error) {
      console.error('Erro ao obter domínios bloqueados:', error);
    }
  }

  // Verifica se uma URL deve ser bloqueada
  function shouldBlockUrl(url) {
    if (!url || blockedDomains.length === 0) return false;
    
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname;
      const fullUrl = url.toLowerCase();
      
      return blockedDomains.some(domain => {
        // Verifica correspondência exata do hostname
        if (hostname === domain) {
          console.log('Content: Bloqueio por hostname exato:', hostname, 'vs', domain);
          return true;
        }
        
        // Verifica se o hostname termina com o domínio (subdomínios)
        if (hostname.endsWith('.' + domain)) {
          console.log('Content: Bloqueio por subdomínio:', hostname, 'vs', domain);
          return true;
        }
        
        // Verifica se o hostname contém o domínio
        if (hostname.includes(domain)) {
          console.log('Content: Bloqueio por conteúdo:', hostname, 'vs', domain);
          return true;
        }
        
        // Verifica a URL completa (para casos com paths específicos)
        if (fullUrl.includes(domain.toLowerCase())) {
          console.log('Content: Bloqueio por URL completa:', fullUrl, 'vs', domain);
          return true;
        }
        
        return false;
      });
    } catch (error) {
      console.error('Erro ao verificar URL no content script:', error);
      return false;
    }
  }

  // Intercepta window.open
  const originalOpen = window.open;
  window.open = function(url, name, features) {
    if (url && shouldBlockUrl(url)) {
      console.log('window.open bloqueado:', url);
      popupBlockedCount++;
      showNotification('Popup bloqueado');
	  window.stop();
      return null;
    }
    return originalOpen.call(window, url, name, features);
  };

  // Intercepta cliques que podem abrir popups
  document.addEventListener('click', function(event) {
    const element = event.target.closest('a, button, [onclick]');
    if (!element) return;

    // Verifica links com target="_blank"
    if (element.tagName === 'A' && element.target === '_blank') {
      const href = element.href;
      if (href && shouldBlockUrl(href)) {
        event.preventDefault();
        event.stopPropagation();
        console.log('Link popup bloqueado:', href);
        popupBlockedCount++;
        showNotification('Popup bloqueado');
		window.stop();
        return false;
      }
    }

    // Verifica onclick handlers que podem conter window.open
    if (element.onclick) {
      const onclickStr = element.onclick.toString();
      if (onclickStr.includes('window.open') || onclickStr.includes('.open(')) {
        // Intercepta temporariamente window.open para este elemento
        const originalWindowOpen = window.open;
        window.open = function(url, name, features) {
          if (url && shouldBlockUrl(url)) {
            console.log('window.open em onClick bloqueado:', url);
            popupBlockedCount++;
            showNotification('Popup bloqueado');
            // Restaura window.open original
            window.open = originalWindowOpen;
			window.stop();
            return null;
          }
          // Restaura window.open original
          window.open = originalWindowOpen;
          return originalWindowOpen.call(window, url, name, features);
        };
        
        // Restaura após um pequeno delay
        setTimeout(() => {
          window.open = originalWindowOpen;
        }, 2000);
      }
    }
  }, true);

  // Intercepta todos os eventos de submissão de formulários
  document.addEventListener('submit', function(event) {
    const form = event.target;
    if (form && form.target === '_blank') {
      const action = form.action;
      if (action && shouldBlockUrl(action)) {
        event.preventDefault();
        event.stopPropagation();
        console.log('Submit popup bloqueado:', action);
        popupBlockedCount++;
        showNotification('Popup bloqueado');
		window.stop();
        return false;
      }
    }
  }, true);

  // Intercepta eventos de beforeunload para detectar redirecionamentos
  window.addEventListener('beforeunload', function(event) {
    // Aqui você pode adicionar lógica adicional se necessário
  });

  // Intercepta modificações no DOM que podem criar popups
  const observer = new MutationObserver(function(mutations) {
    mutations.forEach(function(mutation) {
      if (mutation.type === 'childList') {
        mutation.addedNodes.forEach(function(node) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            // Verifica novos links adicionados
            const links = node.querySelectorAll ? node.querySelectorAll('a[target="_blank"]') : [];
            links.forEach(function(link) {
              if (shouldBlockUrl(link.href)) {
                link.addEventListener('click', function(e) {
                  e.preventDefault();
                  e.stopPropagation();
                  console.log('Link popup dinâmico bloqueado:', link.href);
                  popupBlockedCount++;
                  showNotification('Popup bloqueado');
				  window.stop();
                  return false;
                });
              }
            });
          }
        });
      }
    });
  });

  // Inicia o observer
  observer.observe(document, {
    childList: true,
    subtree: true
  });

  // Função para mostrar notificação de popup bloqueado
  function showNotification(message) {
    // Cria uma notificação discreta
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      background: #ff4444;
      color: white;
      padding: 10px 15px;
      border-radius: 5px;
      font-size: 14px;
      z-index: 999999;
      opacity: 0;
      transition: opacity 0.3s;
    `;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    // Anima a entrada
    setTimeout(() => {
      notification.style.opacity = '1';
    }, 200);
    
    // Remove após 10 segundos
    setTimeout(() => {
      notification.style.opacity = '0';
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    }, 10000);
  }

  // Listener para mensagens do service worker
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'popupBlocked') {
      popupBlockedCount++;
      showNotification('Link bloqueado pelo Bloqueador de Anúncios e Popups');
	  window.stop();
    }
  });

  // Intercepta tentativas de redirecionamento via JavaScript (abordagem mais segura)
  const originalAssign = window.location.assign;
  if (originalAssign) {
    window.location.assign = function(url) {
      if (shouldBlockUrl(url)) {
        console.log('Redirecionamento assign bloqueado:', url);
        popupBlockedCount++;
        showNotification('Redirecionamento bloqueado');
		window.stop();
        return;
      }
      return originalAssign.call(window.location, url);
    };
  }
  
  // Intercepta tentativas de redirecionamento via JavaScript (abordagem com window.location.href)
  const originalHref = window.location.href;
  let hrefDescriptor = Object.getOwnPropertyDescriptor(window.location, 'href');
  if (hrefDescriptor && hrefDescriptor.set) {
    const originalSetter = hrefDescriptor.set;
  
    Object.defineProperty(window.location, 'href', {
      set: function(value) {
        if (shouldBlockUrl(value)) {
          console.log('Redirecionamento bloqueado:', value);
          popupBlockedCount++;
          showNotification('Redirecionamento bloqueado');
		  window.stop();
          return;
        }
        originalSetter.call(this, value);
      }
    });
  }

  // Intercepta document.location (alternativa mais segura)
  if (document.location && document.location.replace) {
    const originalDocReplace = document.location.replace;
    document.location.replace = function(url) {
      if (shouldBlockUrl(url)) {
        console.log('Redirecionamento document.location bloqueado:', url);
        popupBlockedCount++;
        showNotification('Redirecionamento bloqueado');
		window.stop();
        return;
      }
      return originalDocReplace.call(document.location, url);
    };
  }
  
  // Interceptar cliques em links
document.addEventListener('click', function(event) {
  const link = event.target.closest('a');
  if (link && link.href) {
    if (shouldBlockUrl(link.href)) {
      event.preventDefault();
      console.log('Redirecionamento bloqueado:', link.href);
      popupBlockedCount++;
      showNotification('Redirecionamento bloqueado');
	  window.stop();
    }
  }
}, true);



const originalLocation = window.location;
const locationProxy = new Proxy(originalLocation, {
  set(target, prop, value) {
    if (prop === 'href' && shouldBlockUrl(value)) {
      console.log('Redirecionamento bloqueado:', value);
      popupBlockedCount++;
      showNotification('Redirecionamento bloqueado');
	  window.stop();
      return true;
    }
    return Reflect.set(target, prop, value);
  }
});

Object.defineProperty(window, 'location', {
  value: locationProxy,
  configurable: false,
  writable: false
});



  // Mantém conexão ativa com o service worker
  let port = null;
  
  function connectToServiceWorker() {
    try {
      port = chrome.runtime.connect({ name: 'popup-blocker' });
      port.onDisconnect.addListener(() => {
        console.log('Conexão com service worker perdida, reconectando...');
        setTimeout(connectToServiceWorker, 1000);
      });
    } catch (error) {
      console.error('Erro ao conectar com service worker:', error);
      setTimeout(connectToServiceWorker, 1000);
    }
  }

  // Inicializa o script
  connectToServiceWorker();
  getBlockedDomains();

  // Recarrega os domínios periodicamente
  setInterval(getBlockedDomains, 60000); // A cada minuto

  console.log('Content script de bloqueio de popups carregado');
})();