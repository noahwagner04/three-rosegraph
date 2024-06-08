import { Group } from 'three';
const three = window.THREE ? window.THREE : { Group }; // Prefer consumption from global THREE, if exists

import RoseGraph from './rosegraph-kapsule.js';
import fromKapsule from './utils/kapsule-class.js';

export default fromKapsule(RoseGraph, three.Group, true);