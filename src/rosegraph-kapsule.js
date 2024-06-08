import * as THREE from "three";
import Kapsule from "kapsule";

// eventually return a kapsule (which will later be turned into a class (inherets from three.group) that calls init(this))
export default Kapsule({
	props: {
		graphData: {
			default: {
				name: "root",
				frameCount: 0,
				children: []
			}
		}
	},
	stateInit(componentOptions) {
		const geometry = new THREE.BoxGeometry(1, 1, 1);
		const material = new THREE.MeshBasicMaterial({
			color: 0x00ff00
		});
		const cube = new THREE.Mesh(geometry, material);
		return {
			mesh: cube
		};
	},

	init(threeObj, state) {
		state.threeGraph = threeObj;
		state.threeGraph.add(state.mesh);
	},

	update(state, changedProps) {
		return;
	}
});