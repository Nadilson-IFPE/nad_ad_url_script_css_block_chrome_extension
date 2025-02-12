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

countBlockedSites();