import { createApp } from "vue";
import "./style.css";
import App from "./App.vue";

import { createEventBus, EventBusSymbol } from "./eventBus";

// 创建并注册事件总线
const eventBus = createEventBus();

const app = createApp(App);

app.provide(EventBusSymbol, eventBus);

app.mount("#app");
