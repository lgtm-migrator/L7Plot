import { ClusterOptions, FlowItem, FlowLevel, FlowMap, LocationItem, LocationLevel, LocationMap } from '../types';
// import { proxy as worklyProxy } from 'workly/index';
import { max, min } from 'lodash-es';

/**
 * 获取当前缩放比zoom下对应的flows
 * @param oldFlows：上一层级的flows
 * @param oldLocationMap：上一层级locations对应的Map
 * @param newLocationMap：当前层级locations对应的Map
 */
function getFlows(
  oldFlows: FlowItem[],
  oldLocationMap: LocationMap,
  newLocationMap: LocationMap
): {
  flows: FlowItem[];
  flowMap: FlowMap;
  minFlowWeight: number;
  maxFlowWeight: number;
} {
  const newFLows: FlowItem[] = [];
  const newFlowMap: FlowMap = new Map();
  // 用于存储相同起终点的flows，如果每条flows长度 > 1，则需要聚合
  const positionFlowMap = new Map<string, FlowItem[]>();
  let minFlowWeight = oldFlows[0]?.weight;
  let maxFlowWeight = oldFlows[0]?.weight;

  function createFlowItem(
    config: Omit<FlowItem, 'fromId' | 'fromLng' | 'fromLat' | 'toId' | 'toLng' | 'toLat'>,
    fromLocation: Pick<LocationItem, 'id' | 'lng' | 'lat'>,
    toLocation: Pick<LocationItem, 'id' | 'lng' | 'lat'>
  ): FlowItem {
    return Object.assign({}, config, {
      fromId: fromLocation.id,
      fromLng: fromLocation.lng,
      fromLat: fromLocation.lat,
      toId: toLocation.id,
      toLng: toLocation.lng,
      toLat: toLocation.lat,
    });
  }

  function createUuid() {
    function S4() {
      // eslint-disable-next-line no-bitwise
      return (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1);
    }
    return `${S4() + S4()}-${S4()}-${S4()}-${S4()}-${S4()}${S4()}${S4()}`;
  }

  function addNewFlow(newFlow: FlowItem) {
    newFLows.push(newFlow);
    newFlowMap.set(newFlow.id, newFlow);
    if (newFlow.weight > maxFlowWeight) {
      maxFlowWeight = newFlow.weight;
    }
    if (newFlow.weight < minFlowWeight) {
      minFlowWeight = newFlow.weight;
    }
  }
  // console.log(oldFlows);
  for (let i = 0; i < oldFlows.length; i++) {
    const flow = oldFlows[i];
    let newFlow = flow;
    const { fromId, toId } = newFlow;
    // 尝试从当前层级的locations中获取fromId和toId对应的location对象，若线路起终点在该层级发生了聚合，则获取为空
    let fromLocation = newLocationMap.get(fromId);
    let toLocation = newLocationMap.get(toId);

    // 如果起终点其中一个发生了聚合，则以下判定为true
    if (!fromLocation || !toLocation) {
      // 如果起点id不在当前层级的locations中，则说明起点发生了聚合，就从上一层级的locations中尝试获取起点对象
      if (!fromLocation) {
        const preFromLocation = oldLocationMap.get(fromId);
        // 根据上一层级的locations的clusterId指向当前层级的聚合后的结点
        const clusterFromLocation = preFromLocation?.parentId && newLocationMap.get(preFromLocation.parentId);
        if (clusterFromLocation) {
          fromLocation = clusterFromLocation;
        }
      }
      if (!toLocation) {
        const preToLocation = oldLocationMap.get(toId);
        const clusterToLocation = preToLocation?.parentId && newLocationMap.get(preToLocation.parentId);
        if (clusterToLocation) {
          toLocation = clusterToLocation;
        }
      }
      if (fromLocation && toLocation) {
        // const hasLocationChange = fromId !== fromLocation.id || toId !== toLocation.id;
        newFlow = createFlowItem(flow, fromLocation, toLocation);
      }
    }
    if (newFlow.fromId !== newFlow.toId) {
      const key = `${newFlow.fromId},${newFlow.toId}`;
      positionFlowMap.set(key, (positionFlowMap.get(key) ?? []).concat(newFlow));
    }
  }
  positionFlowMap.forEach((flowList) => {
    // 当起终点相同的flows长度 > 1时，则需要进行线路聚合。
    if (flowList.length > 1) {
      const { fromId, toId, fromLat, toLat, fromLng, toLng } = flowList[0];
      const clusterFlow = createFlowItem(
        {
          childIds: flowList.map((flow) => flow.id),
          id: createUuid(),
          isCluster: true,
          originData: [],
          weight: flowList.map((link) => link.weight).reduce((a, b) => a + b, 0),
        },
        { id: fromId, lng: fromLng, lat: fromLat },
        { id: toId, lng: toLng, lat: toLat }
      );
      addNewFlow(clusterFlow);
    } else if (flowList[0]) {
      const firstChildFlow = flowList[0]!;
      addNewFlow(firstChildFlow);
    }
  });
  return {
    flows: newFLows.sort((a, b) => a.weight - b.weight),
    flowMap: newFlowMap,
    minFlowWeight,
    maxFlowWeight,
  };
}

/**
 * 获取所有层级的聚合线数据
 * @param flows
 * @param locationLevels
 * @param clusterOptions
 */
export async function getFlowLevels(
  flows: FlowItem[],
  locationLevels: LocationLevel[],
  clusterOptions: ClusterOptions
) {
  if (!locationLevels.length || !flows.length) {
    return [];
  }
  const originLocationMap = locationLevels[0].locationMap;
  const originZoom = locationLevels[0].zoom;
  const originFlows = [...flows];

  let previousZoom = originZoom;
  let previousLocationMap = originLocationMap;
  let previousFlows = originFlows;
  // 存储最高缩放比下的原始数据
  const flowLevels: FlowLevel[] = [
    {
      zoom: previousZoom,
      flows: previousFlows,
      flowMap: new Map(previousFlows.map((flow) => [flow.id, flow])),
      minFlowWeight: min(flows.map((flow) => flow.weight)) ?? 0,
      maxFlowWeight: max(flows.map((flow) => flow.weight)) ?? 0,
    },
  ];
  const getFlowsSync = getFlows;
  for (let index = 1; index < locationLevels.length; index++) {
    const { zoom: newZoom, locationMap: newLocationMap } = locationLevels[index];
    const {
      flows: newFlows,
      flowMap: newFlowMap,
      minFlowWeight,
      maxFlowWeight,
    } = await getFlowsSync(previousFlows, previousLocationMap, newLocationMap);

    flowLevels.push({
      zoom: newZoom,
      flows: newFlows,
      flowMap: newFlowMap,
      minFlowWeight,
      maxFlowWeight,
    });

    previousFlows = newFlows;
    previousZoom = newZoom;
    previousLocationMap = newLocationMap;
  }
  return flowLevels;
}
