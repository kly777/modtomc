import { ref } from "vue";

// 定义点云数据类型
export interface VoxelData {
    x: number;
    y: number;
    z: number;
    r: number;
    g: number;
    b: number;
}

// 创建事件类型
export const VOXEL_DATA_EVENT = "point-cloud-update";

// 创建响应式数据容器
export const VoxelData = ref<VoxelData[]>([]);

// 创建事件总线接口
export const EventBusSymbol = Symbol();

export interface EventBus {
    emit(event: string, data: any): void;
    on(event: string, callback: (data: any) => void): void;
}

// 创建单例事件总线实例
let eventBusInstance: EventBus | null = null;

export const createEventBus = (): EventBus => {
    if (!eventBusInstance) {
        const listeners: Map<string, Set<(data: any) => void>> = new Map();
        
        eventBusInstance = {
            emit(event, data) {
                listeners.get(event)?.forEach((callback) => callback(data));
            },
            on(event, callback) {
                if (!listeners.has(event)) {
                    listeners.set(event, new Set());
                }
                listeners.get(event)?.add(callback);
            },
        };
    }
    return eventBusInstance;
};

// 导出单例事件总线
export const eventBus = createEventBus();
