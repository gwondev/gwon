// 현재 시간 갱신
function updateTime() {
    document.getElementById('current-time').textContent = new Date().toLocaleString();
}
setInterval(updateTime, 1000);
updateTime();

// WebSocket 연결 및 구독
// 서버와 WebSocket 통신 연결을 시작한다
var socket = new SockJS('/ws');

// WebSocket은 연결되었고, 이제 STOMP 프로토콜(메시지 포맷과 규칙)을 사용하겠다
var stompClient = Stomp.over(socket);

// 서버에 STOMP 연결을 시도한다
stompClient.connect({}, () => {

    // '/topic/data' 경로로 메시지가 오면 구독해서 받아 처리하겠다
    stompClient.subscribe('/topic/data', (message) => {

        // 받은 메시지를 담을 div 요소 생성
        var div = document.createElement('div');
        div.className = 'data-item';
        div.textContent = message.body;

        // 생성한 div를 화면에 추가하여 메시지를 표시
        document.getElementById('data-list').appendChild(div);
    });

});
