let map;
const markers = {};

function initMap() {
  map = L.map("map").setView([35.1434, 126.9318], 15);

  // OpenStreetMap 타일 추가
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "© OpenStreetMap contributors",
  }).addTo(map);

  connectWebSocket();
}

function connectWebSocket() {
  const socket = new SockJS("/ws");
  const client = new StompJs.Client({
    webSocketFactory: () => socket,
    onConnect: () => {
      console.log("✅ WebSocket 연결됨");

      client.subscribe("/topic/data", (message) => {
        const data = JSON.parse(message.body);
        const { id, lat, lng, name } = data;

        const pos = [lat, lng];

        if (markers[id]) {
          markers[id].setLatLng(pos);
        } else {
          const marker = L.marker(pos).addTo(map).bindPopup(name);
          markers[id] = marker;
        }
      });
    },
    onStompError: (error) => {
      console.error("❌ STOMP 에러:", error);
    },
  });

  client.activate();
}

window.onload = initMap;
