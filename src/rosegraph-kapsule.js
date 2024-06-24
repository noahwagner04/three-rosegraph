import * as THREE from "three";
import Kapsule from "kapsule";
import accessorFn from 'accessor-fn';

export default Kapsule({
	props: {
		graphData: {
			default: {
				name: "root",
				frameCount: 0,
				children: [],
			},

			// deep copy graph data (because it will be changed)
			onChange(newVal, state) {
				// use polyfill if we need to support older browsers
				state.roseGraphData = structuredClone(this.graphData());
			}
		},

		visibleFrames: {
			default: d => {
				return Array.from(Array(d.frameCount).keys());
			},
		},

		excludeLayers: {
			default: d => [],
		},

		scale: {
			default: "values",
		},

		category: {
			default: "isCategory"
		},

		resolution: {
			default: d => {
				if (d.depth === 1) {
					return 360;
				}
				let count = Math.floor(12 / d.depth);
				return count < 2 ? 2 : count;
			},
		},

		color: {
			default: d => {
				let b = Math.floor(255 / d.node.depth);
				return `rgba(${b}, ${b}, ${b})`
			}
		},

		thickness: {
			default: d => 10
		},

		radius: {
			default: d => 100
		},
	},

	// populate with internal variables as needed
	stateInit(componentOptions) {
		return {
			roseGraphData: {},
			roseGraphNodes: [],
		};
	},

	// get a refference to the threejs object
	init(threeObj, state) {
		state.threeObj = threeObj;
	},

	// update graph mesh based on changes in properties
	update(state, changedProps) {
		state.firstUpdate = state.firstUpdate === undefined ? true : false;

		var colorAccessor = accessorFn(this.color());
		var resAccessor = accessorFn(this.resolution());
		var frameAccessor = accessorFn(this.visibleFrames());
		var layerAccessor = accessorFn(this.excludeLayers());
		var scaleAccessor = accessorFn(this.scale());
		var categoryAccessor = accessorFn(this.category());
		var thicknessAccessor = accessorFn(this.thickness());
		var radiusAccessor = accessorFn(this.radius());

		if (state.firstUpdate || changedProps.graphData) {
			state.threeObj.clear();
			state.roseGraphNodes = [];

			link(state.roseGraphData);
			model(state.roseGraphData);
			build(state.roseGraphData);
			return;
		}

		if (changedProps.visibleFrames || changedProps.excludeLayers) {
			displayVisibleFrames();
		}

		if (changedProps.resolution || 
			changedProps.radius || 
			changedProps.thickness) {
			state.threeObj.clear();
			state.roseGraphNodes.forEach(node => {
				node.meshArr = [];
			});
			build(state.roseGraphData);
		}

		if (changedProps.color) {
			state.roseGraphNodes.forEach(node => {
				if (node.depth === 0) return;
				node.meshArr.forEach(mesh => {
					mesh.material.color = new THREE.Color().set(colorAccessor({
						node: node,
						frame: mesh.frame
					}));
				});
			});
		}

		function link(root) {
			var i = 0;

			function recurse(node, parent) {
				node.parent = parent;
				node.depth = parent ? parent.depth + 1 : 0;

				state.roseGraphNodes.push(node);

				if (node.children) node.children.forEach(function(n) {
					recurse(n, node);
				});

				if (!node.id) node.id = ++i;
			}

			recurse(root, null);
		}

		function countChildren(node) {
			if (node.count) {
				return node.count;
			} else if (node.children) {
				return node.children.length;
			} else {
				return 0;
			}
		}

		function model(root, fixedSize) {

			function recurse(node, parent) {
				var angleStart, angleEnd, angleDiv = 0,
					angleMid;
				var count, countN;

				angleStart = node.angleStart;
				angleEnd = node.angleEnd;
				angleMid = angleStart + ((angleEnd - angleStart) / 2.0);

				countN = countChildren(node)
				count = countN;
				if (parent && fixedSize) {
					parent.children.forEach(function(n) {
						count = Math.max(count, countChildren(n));
					});
				}

				angleDiv = (angleEnd - angleStart) / count;
				angleStart = angleMid - (angleDiv * countN) / 2.0;

				if (node.children) {
					node.children.forEach(function(n) {
						n.angleStart = angleStart;
						n.angleEnd = angleStart + angleDiv;

						angleStart += angleDiv;

						recurse(n, node);
					});
				}
			}

			root.angleStart = 0;
			root.angleEnd = 2 * Math.PI;

			recurse(root, null);
		}

		function build(root) {
			var defaultFrameAccessor = accessorFn(d => {
				return Array.from(Array(d.frameCount).keys());
			});
			var frames = defaultFrameAccessor(state.roseGraphData);

			function recurse(node) {
				node.meshArr = [];
				var max_val = Math.max(...node.values);
				for (var i = 0; i < frames.length; i++) {
					var f = frames[i];
					var r = categoryAccessor(node) ? 100 : nodeRelativeValue(node, f, max_val, 100);

					var angleStart = node.angleStart;
					var angleEnd = node.angleEnd;
					var radiusInner = radiusAccessor(node) + (node.depth - 1) * 100;
					var radiusOuter = radiusInner + (r == 0 ? 1 : r);
					var cx, cy;

					if (angleStart < angleEnd) {
						var pie = new THREE.Shape();

						var pointCount = resAccessor(node);
						var angleInc = (angleEnd - angleStart) / pointCount;

						for (var j = 0; j <= pointCount; j++) {
							cx = radiusOuter * Math.cos(angleStart + (j * angleInc));
							cy = radiusOuter * Math.sin(angleStart + (j * angleInc));
							if (j == 0) {
								pie.moveTo(cx, cy);
							} else {
								pie.lineTo(cx, cy);
							}
						}

						if (radiusInner != 0) {
							for (var k = 0; k <= pointCount; k++) {
								cx = radiusInner * Math.cos(angleEnd - (k * angleInc));
								cy = radiusInner * Math.sin(angleEnd - (k * angleInc));
								pie.lineTo(cx, cy);
							}

							// Close it.
							cx = radiusOuter * Math.cos(angleStart);
							cy = radiusOuter * Math.sin(angleStart);
							pie.lineTo(cx, cy);
						}


						var pieGeometry = new THREE.ExtrudeGeometry(pie, {
							depth: thicknessAccessor({
								node: node,
								frame: f,
							}),
							steps: 1,
							bevelEnabled: false
						});

						var material = new THREE.MeshStandardMaterial({
							color: colorAccessor({
								node: node,
								frame: f
							})
						});
						var mesh = new THREE.Mesh(pieGeometry, material);
						mesh.frame = f;
						mesh.labelPoint = {
							x: ((radiusInner + radiusOuter) / 2) * Math.cos(angleStart + (pointCount / 2 * angleInc)),
							y: ((radiusInner + radiusOuter) / 2) * Math.sin(angleStart + (pointCount / 2 * angleInc)),
							z: 0
						};
						mesh.node = node;

						// if (i == 0) {
						// 	state.threeObj.add(mesh);
						// } else {
						// 	mesh.parentMesh = node.meshArr[0];
						// 	mesh.parentMesh.add(mesh);
						// }

						node.meshArr.push(mesh);
					}
				}

				if (node.children) {
					node.children.forEach(function(n) {
						recurse(n);
					});
				}

			}

			if (!root.children) return;
			root.children.forEach(function(n) {
				recurse(n);
			});

			displayVisibleFrames();
		}

		// should use accessorFn when accessing scale
		function nodeRelativeValue(node, frame, max_val, high_map_val) {
			return scaleAccessor(node)[frame] / max_val * high_map_val;
		}


		function displayVisibleFrames() {
			state.threeObj.clear();
			let excludeLayers = layerAccessor(state.roseGraphData);

			state.roseGraphNodes.forEach(node => {
				let zPos = 0;
				if (node.depth === 0) return;

				if (excludeLayers.indexOf(node.depth) !== -1) return;

				frameAccessor(state.roseGraphData).forEach(frame => {
					let mesh = node.meshArr[frame];
					mesh.position.z = zPos;
					zPos += thicknessAccessor({
						node: node,
						frame: frame,
					});
					state.threeObj.add(mesh);
				});
			});
		}
	}
});