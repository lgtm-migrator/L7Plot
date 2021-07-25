---
title: 气泡地图 - Bubble Map
order: 1
---

`BubbleMap` 继承自 [PointMap](/zh/docs/api/point-maps/point-map)。

## 一、配置

创建地图实例：

```ts
import { BubbleMap } from '@antv/l7plot';
const bubbleMap = new BubbleMap(container, options);
```

### container

`string|HTMLDivElement` required

地图渲染的 DOM 容器。

### options

`BubbleMapOptions` required

气泡地图的所有配置项，继承自 [PointMap options](/zh/docs/api/point-maps/point-map#options)。

### `options.`animate

`boolean｜object` optional default: `false`

气泡水波动画效果配置。

```js
{
  animate: true;
}
```

### `animate.`speed

`number` optional default: `1`

水波速度。

### `animate.`rings

`number` optional default: `3`

水波环数。

## 二、属性

继承 [Map 属性](/zh/docs/api/map-api#二、属性)。

### bubbleLayer

`ILayer`

气泡图层实例。

### labelLayer

`undefined|ILayer`

数据标签图层实例。

## 三、方法

继承 [Map 方法](/zh/docs/api/map-api#三、方法)。

## 四、事件

继承 [Map 方法](/zh/docs/api/map-api#四、事件)。

内置图层名称分别为：

- 'bubbleLayer'
- 'labelLayer'

```js
bubbleMap.on('bubbleLayer:click', (e) => {});
// Or
bubbleMap.bubbleLayer.on('click', (e) => {});
```