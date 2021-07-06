import { PointMap } from '../../../../src';
import { DEFAULT_OPTIONS } from '../../../../src/maps/point-map/constants';
import { createDiv } from '../../../helper/dom';
import data from '../../../data-set/point-temperature.json';

describe('point map', () => {
  it('defaultOptions', () => {
    expect(PointMap.DefaultOptions).toEqual(DEFAULT_OPTIONS);
  });

  it('source', () => {
    const pointMap = new PointMap(createDiv(), {
      source: {
        data: data.list,
        parser: { type: 'json', x: 'j', y: 'w' },
      },
      color: {
        field: 't',
        value: ['#34B6B7', '#4AC5AF', '#5FD3A6', '#7BE39E', '#A1EDB8', '#CEF8D6'],
      },
      size: {
        field: 't',
        value: [0, 20],
      },
      style: {
        opacity: 0.5,
        strokeWidth: 0,
      },
      label: {
        field: 't',
        style: {
          fill: '#fff',
          opacity: 0.6,
          fontSize: 12,
        },
      },
    });

    expect(pointMap.type).toEqual('point');
    expect(pointMap.pointLayer).toBeDefined();

    pointMap.destroy();
  });
});