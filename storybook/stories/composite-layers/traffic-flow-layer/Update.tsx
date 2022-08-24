import React, { Component, useEffect, useState } from 'react';
import { Scene, GaodeMapV2 } from '@antv/l7';
import {
  FlowItem,
  H3ClusterOptions,
  HCAClusterOptions,
  LocationItem,
  TrafficFlowLayer,
} from '@antv/l7-composite-layers';

function getRandomColor() {
  //rgb颜色随机
  const r = Math.floor(Math.random() * 256);
  const g = Math.floor(Math.random() * 256);
  const b = Math.floor(Math.random() * 256);
  return 'rgb(' + r + ',' + g + ',' + b + ')';
}

const ClusterOptionsList: [HCAClusterOptions, H3ClusterOptions] = [
  {
    clusterType: 'HCA',
    zoomStep: 1,
    clusterLevel: 10,
  },
  {
    clusterType: 'H3',
    zoomStep: 1,
    h3Range: [5, 9],
  },
];

export default () => {
  const [scene, setScene] = useState<Scene | null>(null);
  const [layer, setLayer] = useState<TrafficFlowLayer | null>(null);
  const [clusterTypeIndex, setClusterTypeIndex] = useState(0);
  const [odData, setOdData] = useState<any[]>([]);

  useEffect(() => {
    const scene = new Scene({
      id: 'container',
      map: new GaodeMapV2({
        pitch: 0,
        style: 'dark',
        center: [121.47583007812501, 31.220435433148147],
        zoom: 9,
      }),
    });

    scene.on('loaded', async () => {
      const response = await fetch(
        'https://gw.alipayobjects.com/os/bmw-prod/f4f3e99a-1d6c-4ab0-b08f-ec730c576b62.json'
      );
      const data = await response.json();
      setOdData(data);
      const trafficFlowLayer = new TrafficFlowLayer({
        cluster: ClusterOptionsList[0],
        fieldGetter: {
          fromLng: 'f_lon',
          fromLat: 'f_lat',
          toLng: 't_lon',
          toLat: 't_lat',
          weight: 'weight',
        },
        pointConfig: {
          state: {
            active: {
              color: '#ffff00',
            },
          },
        },
        lineConfig: {
          state: {
            active: {
              color: '#ffff00',
            },
          },
        },
        source: {
          // data,
          data: data.slice(0, 10000),
        },
      });
      trafficFlowLayer.addTo(scene);

      trafficFlowLayer.locationLayer.on('click', (e: any) => {
        const { id } = e.feature as LocationItem;
        console.log(trafficFlowLayer.getLocationData(id));
      });

      trafficFlowLayer.flowLayer.on('click', (e) => {
        const { id } = e.feature as FlowItem;
        console.log(trafficFlowLayer.getFlowData(id));
      });

      setScene(scene);
      setLayer(trafficFlowLayer);
    });
  }, []);

  return (
    <>
      <div style={{ position: 'absolute', top: 0, left: 0, zIndex: 10 }}>
        <button
          onClick={() => {
            const color1 = getRandomColor();
            const color2 = getRandomColor();
            layer?.update({
              pointConfig: {
                color: {
                  field: 'weight',
                  value: [color1, color2],
                },
                size: 10,
              },
              lineConfig: {
                color: undefined,
                size: {
                  field: 'weight',
                  value: [1, 20],
                },
                style: {
                  targetColor: color1,
                  sourceColor: color2,
                },
              },
            });
          }}
        >
          改变样式
        </button>
        <button
          onClick={() => {
            const newClusterIndex = clusterTypeIndex === 0 ? 1 : 0;
            layer?.update({
              cluster: ClusterOptionsList[newClusterIndex],
            });
            setClusterTypeIndex(newClusterIndex);
          }}
        >
          改变聚合方式
        </button>

        <button
          onClick={() => {
            layer?.changeData({
              data: odData.filter(() => Math.random() > 0.9) ?? [],
            });
          }}
        >
          设置随机数据
        </button>
      </div>
      <div
        id="container"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          overflow: 'hidden',
        }}
      ></div>
    </>
  );
};
