import * as THREE from "three";
import Kapsule from "kapsule";

export default Kapsule({
	props: {
		graphData: {
			default: {
				name: "root",
				frameCount: 0,
				children: [],
			},
		},
		valueScale: {
			default: 1,
			// will update state.renderData properly
		},
		pointResolution: {
			// something like this
			default: (depth) => {
				if(depth === 0) {
					return 360;
				}
				let count = Math.floor(12 / depth);
				return count < 2 ? 2 : count;
			},
		},

		sectorColor: {
			// something like this
			default: (node, depth) => {
				return {
					r: depth * 10,
					g: depth * 10,
					b: depth * 10
				};
			},
		}
	},

	// populate with internal variables as needed
	stateInit(componentOptions) {
		return {
			// root node will optionally be a cylinder or nothing (meshes stays empty)
			renderData: {
				name: "root",
				frameCount: 0,
				startAngle: 0,
				endAngle: 2 * Math.PI,
				depth: 0,
				meshes: [],
				children: [],
			},
		};
	},

	// get a refference to the threejs object
	init(threeObj, state) {
		state.threeObj = threeObj;
	},

	// update graph mesh based on changes in properties
	update(state, changedProps) {
		return;
	}
});