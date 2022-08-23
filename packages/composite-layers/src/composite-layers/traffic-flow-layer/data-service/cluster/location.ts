import {
  ClusterOptions,
  H3ClusterOptions,
  HCAClusterOptions,
  LocationItem,
  LocationLevel,
  LocationMap,
  MapStatus,
} from '../types';
import KDBush from 'kdbush';
import { createUuid } from '../utils';
import { createLocationItem } from '../init';
import { geoToH3, h3ToGeo } from 'h3-js';

/**
 * 生成kdbush搜索树
 * @param locations
 */
export function getSearchTree(locations: LocationItem[]): KDBush<LocationItem> {
  return new KDBush<LocationItem>(
    locations,
    (p) => p.x,
    (p) => p.y,
    64,
    Float64Array
  );
}

/**
 * 生成点聚合数据入口，改函数内根据options中决策选用哪一种聚合类型
 * @param locations
 * @param clusterOptions
 * @param mapStatus
 */
export function getLocationLevels(
  locations: LocationItem[],
  clusterOptions: ClusterOptions,
  mapStatus: MapStatus
): LocationLevel[] {
  // 原始数据为空时直接返回空数据
  if (!locations.length) {
    return [];
  }
  // 获取遍历zoom的粒度
  const { zoomStep } = clusterOptions;
  // 当前地图支持的最小和最大的缩放比
  const { minZoom, maxZoom } = mapStatus;

  let oldLocations = [...locations];
  let oldTree = getSearchTree(oldLocations);
  // 将最大缩放比以及原始数据作为locationLevels的第一项
  const locationLevels: LocationLevel[] = [
    {
      zoom: maxZoom,
      locations: oldLocations,
      locationMap: new Map(oldLocations.map((location) => [location.id, location])),
      locationTree: oldTree,
    },
  ];

  // 从大到小依次遍历所有缩放比
  for (let zoom = maxZoom - zoomStep; zoom >= minZoom; zoom -= zoomStep) {
    const result = (() => {
      if (clusterOptions.clusterType === 'HCA') {
        return getLocationsByHCA(oldLocations, oldTree, zoom, clusterOptions as HCAClusterOptions);
      } else {
        return getLocationsByH3(oldLocations, zoom, clusterOptions as H3ClusterOptions);
      }
    })();
    if (!result) {
      continue;
    }
    const { locations: newLocations, locationMap: newLocationMap } = result;
    if (newLocations.length < oldLocations.length) {
      // 仅有新的locations长度比上一层级的locations长度更小时才保存数据
      const newTree = getSearchTree(newLocations);
      locationLevels.push({
        zoom,
        locations: newLocations,
        locationMap: newLocationMap,
        locationTree: newTree,
      });
      oldLocations = newLocations;
      oldTree = newTree;
    }
  }

  if (locationLevels.length > 1) {
    locationLevels[0].zoom = locationLevels[1].zoom + zoomStep;
  }
  return locationLevels;
}

/**
 * 遍历上一层级的点数据，用HCA算法聚合当前层级zoom下的点数组
 * @param oldLocations
 * @param tree
 * @param zoom
 * @param clusterOptions
 */
function getLocationsByHCA(
  oldLocations: LocationItem[],
  tree: KDBush<LocationItem>,
  zoom: number,
  clusterOptions: HCAClusterOptions
): {
  locations: LocationItem[];
  locationMap: LocationMap;
} | null {
  const { clusterLevel = 10 } = clusterOptions;
  let newLocations: LocationItem[] = [];
  const newLocationMap: LocationMap = new Map();
  const radius = clusterLevel / (128 * Math.pow(2, zoom));
  const doneIdSet = new Set();

  for (const location of oldLocations) {
    if (doneIdSet.has(location.id)) {
      continue;
    }
    const innerIndexes = tree.within(location.x, location.y, radius);
    doneIdSet.add(location.id);

    if (innerIndexes.length > 1) {
      let weight = location.weight;
      let weightX = location.x * weight;
      let weightY = location.y * weight;
      const childIds: string[] = [location.id];
      // const originData: any[] = [...location.originData];
      const parentId = createUuid();
      for (const innerIndex of innerIndexes) {
        const innerLocation = tree.points[innerIndex];
        if (doneIdSet.has(innerLocation.id)) {
          continue;
        }
        doneIdSet.add(innerLocation.id);
        weight += innerLocation.weight;
        weightX += innerLocation.weight * innerLocation.x;
        weightY += innerLocation.weight * innerLocation.y;
        innerLocation.parentId = parentId;
        childIds.push(innerLocation.id);
        // originData.push(...innerLocation.originData);
      }
      // 仅当cluster子节点数量大于1时才升级了新Cluster
      // 防止圆内的其他结点都是已经被聚合过的
      if (childIds.length > 1) {
        location.parentId = parentId;
        const newLocation = createLocationItem({
          x: weightX / weight,
          y: weightY / weight,
          childIds,
          id: parentId,
          weight,
          isCluster: true,
          originData: [],
          // originData,
        });
        newLocations.push(newLocation);
        newLocationMap.set(newLocation.id, newLocation);
        continue;
      }
    }
    newLocations.push(location);
    newLocationMap.set(location.id, location);
  }

  if (newLocations.length < oldLocations.length) {
    newLocations = newLocations.sort((a, b) => a.weight - b.weight);
  }

  return {
    locations: newLocations,
    locationMap: newLocationMap,
  };
}

/**
 * 遍历上一层级的点数据，用HCA算法聚合当前层级zoom下的点数组
 * @param oldLocations
 * @param zoom
 * @param clusterOptions
 */
function getLocationsByH3(
  oldLocations: LocationItem[],
  zoom: number,
  clusterOptions: H3ClusterOptions
): {
  locations: LocationItem[];
  locationMap: LocationMap;
} | null {
  const { h3Range } = clusterOptions;
  const h3Level = zoom - 5;
  if (h3Range?.length) {
    const [minZoom, maxZoom] = h3Range;
    if (h3Level < minZoom || h3Level > maxZoom) {
      return null;
    }
  }
  const newLocations: LocationItem[] = [];
  const newLocationMap: LocationMap = new Map();
  const h3IndexMap = new Map<string, LocationItem[]>();

  for (const location of oldLocations) {
    const { lat, lng } = location;
    const h3Index = geoToH3(lat, lng, h3Level);
    const targetList = h3IndexMap.get(h3Index) ?? [];
    targetList.push(location);
    h3IndexMap.set(h3Index, targetList);
  }

  if (h3IndexMap.size === oldLocations.length) {
    return null;
  }
  h3IndexMap.forEach((locations, h3Index) => {
    const [lat, lng] = h3ToGeo(h3Index);
    const parentId = createUuid();
    locations.forEach((location) => {
      location.parentId = parentId;
    });
    const newLocation = createLocationItem({
      isCluster: true,
      lng,
      lat,
      childIds: locations.map((location) => location.id),
      id: parentId,
      parentId: null,
      weight: locations.map((item) => item.weight).reduce((a, b) => a + b),
      originData: [],
    });
    newLocations.push(newLocation);
    newLocationMap.set(newLocation.id, newLocation);
  });

  return {
    locations: newLocations.sort((a, b) => a.weight - b.weight),
    locationMap: newLocationMap,
  };
}
