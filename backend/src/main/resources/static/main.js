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
    else if(tabName === "move"){
            area.innerHTML = `
                <h3>GPS 위치 데이터</h3>
                <button onclick="loadGpsData()">새로고침</button>
                <div id="gps-list"></div>
            `;
            loadGpsData();
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


// GPS 데이터 로드
function loadGpsData() {
    fetch('/api/gps')
        .then(response => response.json())
        .then(data => {
            displayGpsData(data);
        })
        .catch(error => {
            document.getElementById('gps-list').innerHTML = 'GPS 데이터 로드 실패';
        });
}

// GPS 데이터 표시
function displayGpsData(gpsDataList) {
    let html = '';
    if(gpsDataList.length === 0) {
        html = '<p>GPS 데이터가 없습니다</p>';
    } else {
        gpsDataList.forEach(gps => {
            html += `
                <div style="border: 1px solid #ccc; padding: 10px; margin: 5px;">
                    <strong>${gps.name || gps.deviceId}</strong><br>
                    위도: ${gps.lat}, 경도: ${gps.lng}<br>
                    <small>시간: ${gps.timestamp}</small>
                </div>
            `;
        });
    }
    document.getElementById('gps-list').innerHTML = html;
}