import { storiesOf } from '@storybook/react';

import HCA from './HCA';
import H3 from './H3';
import Update from './Update';

storiesOf('复合图层/OD客流聚合图层', module).add('HCA 算法', () => <HCA />);
storiesOf('复合图层/OD客流聚合图层', module).add('H3 算法', () => <H3 />);
storiesOf('复合图层/OD客流聚合图层', module).add('更新配置', () => <Update />);
// storiesOf('复合图层/test', module).add('test', () => <TEST />);
