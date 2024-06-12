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

		visibleFrames: {
			default: null,
		},

		scale: {
			default: "values",
			// use accessorFn lib
		},

		resolution: {
			// something like this
			default: (depth) => {
				if (depth === 0) {
					return 360;
				}
				let count = Math.floor(12 / depth);
				return count < 2 ? 2 : count;
			},
		},

		color: {
			// use accessorFn lib
			default: d => "green"
		}
	},

	// populate with internal variables as needed
	stateInit(componentOptions) {
		return {};
	},

	// get a refference to the threejs object
	init(threeObj, state) {
		state.threeObj = threeObj;
	},

	// update graph mesh based on changes in properties
	update(state, changedProps) {


		//if(!changedProps.graphData) return;

		if(typeof(this.visibleFrames()) !== "function") {
			this.visibleFrames(() => {
				return Array.from(Array(this.graphData().frameCount).keys());
			}); 
		}

		state.threeObj.clear();

		function link(root) {
			var i = 0;

			function recurse(node, parent) {
				node.parent = parent;
				node.depth = parent ? parent.depth + 1 : 0;

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

				// node.level = 1;
				// if (typeof(node.index) !== "undefined")
				// 	node.level = node.index.split(".").length + 1;

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

		function build(root, frames_func, res_func) {
			//change to function
			//var pointCounts = [360, 12, 6, 2, 2, 2, 2, 2, 2, 2];

			var frames = frames_func();

			function recurse(node) {
				node.meshArr = [];
				console.log(node.values)
				var max_val = Math.max(...node.values); 

				for (var i = 0; i < frames.length; i++) {
					var f = frames[i];
					// FIX
					var r = nodeRelativeValue(node, f, max_val, 100);

					var angleStart = node.angleStart;
					var angleEnd = node.angleEnd;
					//var radiusInner = (node.level - 1) * 100;
					var radiusInner = node.depth * 100
					var radiusOuter = radiusInner + (r == 0 ? 1 : r);
					var cx, cy;

					if (angleStart < angleEnd) {
						var pie = new THREE.Shape();

						//var pointCount = pointCounts[node.level - 1]; // Math.max( ((angleEnd - angleStart) / (Math.PI * 2)) * 360, 3 );
						var pointCount = res_func(node.depth);
						var angleInc = (angleEnd - angleStart) / pointCount;

						for (var i = 0; i <= pointCount; i++) {
							cx = radiusOuter * Math.cos(angleStart + (i * angleInc));
							cy = radiusOuter * Math.sin(angleStart + (i * angleInc));
							if (i == 0) {
								pie.moveTo(cx, cy);
							} else {
								pie.lineTo(cx, cy);
							}
						}

						if (radiusInner != 0) {
							for (var i = 0; i <= pointCount; i++) {
								cx = radiusInner * Math.cos(angleEnd - (i * angleInc));
								cy = radiusInner * Math.sin(angleEnd - (i * angleInc));
								pie.lineTo(cx, cy);
							}

							// Close it.
							cx = radiusOuter * Math.cos(angleStart);
							cy = radiusOuter * Math.sin(angleStart);
							pie.lineTo(cx, cy);
						}


						var pieGeometry = new THREE.ExtrudeGeometry(pie, {
							amount: 10,
							steps: 1,
							bevelEnabled: false
						});
						// FIX
						var material = new THREE.MeshBasicMaterial( {color: (Math.random() * 0xfffff * 1000000)} );
						var mesh = new THREE.Mesh(pieGeometry, material);
						mesh.frame = f;
						mesh.position.z = i * 10;
						// mesh.scale.z = i <= activeIndex ? 1 : 0;
						mesh.scaleZ = mesh.scale.z;
						mesh.visible = mesh.scaleZ > 0.0;
						mesh.labelPoint = {
							x: ((radiusInner + radiusOuter) / 2) * Math.cos(angleStart + (pointCount / 2 * angleInc)),
							y: ((radiusInner + radiusOuter) / 2) * Math.sin(angleStart + (pointCount / 2 * angleInc)),
							z: 0
						};
						mesh.node = node;

						if (f == 0) {
							state.threeObj.add(mesh);
						} else {
							mesh.parentMesh = node.meshArr[0];
							mesh.parentMesh.add(mesh);
						}

						node.meshArr.push(mesh);
					}
				}

				if (node.children) {
					node.children.forEach(function(n) {
						recurse(n);
					});
				}

			}

			//recurse(root);
			root.children.forEach(function(n) {
				recurse(n);
			});
		}

		// should use accessorFn when accessing scale
		function nodeRelativeValue(node, frame, max_val, high_map_val) {
			return node.values[frame] / max_val * high_map_val;
		}

		link(this.graphData());
		model(this.graphData());
		build(this.graphData(), this.visibleFrames(), this.resolution());

	}
});