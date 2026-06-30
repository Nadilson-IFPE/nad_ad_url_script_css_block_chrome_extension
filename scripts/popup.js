async function countBlockedSites() {
    try {
        const response = await fetch('../rules/rules_1.json');
        const rules = await response.json();
        const itemCount = rules.length.toLocaleString('pt-BR'); 
        document.getElementById('itemCount').textContent = `Itens na lista negra: ${itemCount}`;
    } catch (error) {
        console.error('Erro ao obter dados sobre as regras de bloqueio:', error);
        document.getElementById('itemCount').textContent = 'Erro ao obter dados sobre as regras de bloqueio: ' + error.toString + '.';
    }
}

document.addEventListener('DOMContentLoaded', async () => {
  const btn = document.getElementById('toggleBtn');

  // Fetch the current state from storage (default to true if not set)
  const data = await chrome.storage.local.get(['isButtonEnabled']);
  let isButtonEnabled = data.isButtonEnabled !== false; 

  // Function to update the button's appearance
  const updateButton = () => {
    if (isButtonEnabled) {
      btn.textContent = 'Pausar exntensão';
      btn.className = 'disable';
    } else {
      btn.textContent = 'Ligar extensão';
      btn.className = 'enable';
    }
  };

  // Toggle state on click
  btn.addEventListener('click', async () => {
    isButtonEnabled = !isButtonEnabled;
    await chrome.storage.local.set({ isButtonEnabled });
    updateButton();
  });

  updateButton();
});

countBlockedSites();