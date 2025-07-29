function showTab(tabName){
    const area = document.getElementById('text');
    if(tabName === "gwon"){
        area.innerHTML = `
            <input type="text" id="input">
            <button onclick="add()">추가</button>
            <div id="list"></div>
        `;
        load();
    }

    else {
        area.innerHTML = tabName;
    }
}

function add() {
    const text = document.getElementById('input').value;
    if (!text) return;

    fetch('/backend/api/gwon/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
    }).then(() => {
        document.getElementById('input').value = '';
        load();
    });
}

function load() {
    fetch('/backend/api/gwon/texts')
        .then(response => response.json())
        .then(data => {
            let html = '';
            data.forEach(item => {
                html += `<div>${item.text} <button onclick="del(${item.id})">X</button></div>`;
            });
            document.getElementById('list').innerHTML = html || '데이터 없음';
        });
}

function del(id) {
    fetch(`/backend/api/gwon/delete/${id}`, { method: 'DELETE' })
        .then(() => load());
}


