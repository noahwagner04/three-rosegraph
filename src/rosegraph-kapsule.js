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

			onChange() {
				//deep copy graph data
			}
		},

		visibleFrames: {
			default: d => {
				return Array.from(Array(d.frameCount).keys());
			},
		},

		scale: {
			default: "values",
			// use accessorFn lib
		},

		resolution: {
			// something like this
			default: d => {
				if (d.depth === 1) {
					return 360;
				}
				let count = Math.floor(12 / d.depth);
				return count < 2 ? 2 : count;
			},
		},

		color: {
			// use accessorFn lib
			default: d => {
				let b = Math.floor(255 / d.depth);
				return `rgb(${b}, ${b}, ${b})`
			}
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

		var colorAccessor = accessorFn(this.color());
		var resAccessor = accessorFn(this.resolution());
		var frameAccessor = accessorFn(this.visibleFrames());
		var scaleAccessor = accessorFn(this.scale());

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

		function build(root, this_) {

			var frames = frameAccessor(this_.graphData());

			function recurse(node) {
				node.meshArr = [];
				var max_val = Math.max(...node.values); 
				for (var i = 0; i < frames.length; i++) {
					var f = frames[i];
					// FIX
					var r = nodeRelativeValue(node, f, max_val, 100);

					var angleStart = node.angleStart;
					var angleEnd = node.angleEnd;
					//var radiusInner = (node.level - 1) * 100;
					var radiusInner = node.depth * 100;
					var radiusOuter = radiusInner + (r == 0 ? 1 : r);
					var cx, cy;

					if (angleStart < angleEnd) {
						var pie = new THREE.Shape();

						//var pointCount = pointCounts[node.level - 1]; // Math.max( ((angleEnd - angleStart) / (Math.PI * 2)) * 360, 3 );
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
							depth: 10,
							steps: 1,
							bevelEnabled: false
						});
						// FIX
						var material = new THREE.MeshStandardMaterial( {color: (colorAccessor(node))} );
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

						if (i == 0) {
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
			return scaleAccessor(node)[frame] / max_val * high_map_val;
		}

		link(this.graphData());
		model(this.graphData());
		build(this.graphData(), this);

	}
});