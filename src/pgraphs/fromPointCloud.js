import { lattices } from '../spacegroups/lattices';
import { pointsF as ops }  from '../geometry/types';


const induceEdges = (points, nrSeeds, graph, dot = ops.times) => {
  const pairsWithDistances = [];

  for (const p of points) {
    const candidates = [];

    for (const q of points) { //TODO use fewer points? (first nrSeeds incorrect)
      if (q.id > p.id) {
        const d = ops.minus(p, q);
        candidates.push([p, q, dot(d, d)]);
      }
    }
    candidates.sort((a, b) => a[2] - b[2]);

    for (let i = 0; i < p.degree; ++i)
      pairsWithDistances.push(candidates[i]);
  }
  pairsWithDistances.sort((a, b) => a[2] - b[2]);

  for (const [p, q, d] of pairsWithDistances) {
    if (graph.degree(p) < p.degree || graph.degree(q) < q.degree)
      graph.addEdge(p, q);
  }
};


class PGraph {
  constructor() {
    this.neighbors = [];
  }

  degree(p) {
    const i = p.originalId;
    const nbrs = this.neighbors[i] || [];
    return nbrs.length + nbrs.filter(([j, _]) => j == i).length;
  }

  addPlainNeighbor(i, j, s) {
    if (this.neighbors[i] == null)
      this.neighbors[i] = [];
    if (this.neighbors[i].every(([k, t]) => k != j || t != s))
      this.neighbors[i].push([j, s]);
  }

  addPlainEdge(i, j, s) {
    if (i == j)
      this.addPlainNeighbor(i, j, s < ops.times(0, s) ? ops.negative(s) : s);
    else {
      this.addPlainNeighbor(i, j, s);
      this.addPlainNeighbor(j, i, ops.negative(s));
    }
  }

  addEdge(p, q) {
    this.addPlainEdge(p.originalId, q.originalId, ops.minus(q.shift, p.shift));
  }

  edges() {
    const result = [];
    for (let i = 0; i < this.neighbors.length; ++i) {
      for (const [j, s] of this.neighbors[i]) {
        if (j >= i)
          result.push([i, j, s]);
      }
    }
    return result;
  }
};


const flatMap   = (fn, xs) => xs.reduce((t, x) => t.concat(fn(x)), []);
const cartesian = (xs, ys) => flatMap(x => ys.map(y => [x, y]), xs);


const fromPointCloud = (rawPoints, explicitEdges, dot) => {
  const eps = Math.pow(2, -40);
  const { dirichletVectors, shiftIntoDirichletDomain } =
        lattices(ops, eps, dot);

  const basis  = ops.identityMatrix(ops.dimension(rawPoints[0].pos));
  const dvs    = dirichletVectors(basis);
  const dvs2   = ops.times(2, dvs);
  const origin = ops.times(0, dvs[0]);

  const points = cartesian([origin].concat(dvs), rawPoints).map(
    ([shift, { id, pos, degree }], i) => {
      const p = ops.plus(pos, shift);
      const s = shiftIntoDirichletDomain(ops.vector(p), dvs2);
      return {
        id: i,
        pos: ops.plus(p, s),
        degree,
        shift: ops.plus(shift, s),
        originalId: id,
        originalPosition: pos
      };
    });

  const G = new PGraph();
  explicitEdges.forEach(([i, j, s]) => G.addPlainEdge(i, j, s));
  induceEdges(points, rawPoints.length, G, dot);
  return G.edges();
};


export default fromPointCloud;
