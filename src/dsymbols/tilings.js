import * as I from 'immutable';
import * as F from '../arithmetic/float';

import _M from '../arithmetic/matrix';
import _V from '../arithmetic/vector';

const M = _M(F, 0, 1);
const V = _V(F, 0);

import * as cosets      from '../fpgroups/cosets';
import * as delaney     from './delaney';
import * as properties  from './properties';
import * as delaney2d   from './delaney2d';
import * as delaney3d   from './delaney3d';
import * as fundamental from './fundamental';
import * as covers      from './covers';
import * as periodic    from '../pgraphs/periodic';


const _remainingIndices = (ds, i) => ds.indices().filter(j => j != i);


const _edgeTranslations = function _edgeTranslations(cov) {
  const fg  = fundamental.fundamentalGroup(cov);
  const n   = fg.nrGenerators;
  const nul = M.nullSpace(M.make(cosets.relatorMatrix(n, fg.relators)));

  return fg.edge2word.map(function(a) {
    return a.map(function(b) {
      const v = M.make([cosets.relatorAsVector(b, n)]);
      return V.make(M.times(v, nul).data.first());
    });
  });
};


const _cornerShifts = function _cornerShifts(cov, e2t) {
  const dim = delaney.dim(cov);
  const zero = V.constant(dim);

  return I.Map().withMutations(function(m) {
    cov.indices().forEach(function(i) {
      const idcs = _remainingIndices(cov, i);

      properties.traversal(cov, idcs, cov.elements()).forEach(function(e) {
        const Dk = e[0];
        const k  = e[1];
        const D  = e[2];

        if (k == properties.traversal.root)
          m.setIn([D, i], zero);
        else
          m.setIn([D, i], V.minus(m.getIn([Dk, i]), e2t.getIn([Dk, k]) || zero));
      });
    });
  });
};


const _skeleton = function _skeleton(cov, e2t, c2s) {
  const dim = delaney.dim(cov);
  const zero = V.constant(dim);
  const chambers = cov.elements();
  const idcs0 = _remainingIndices(cov, 0);
  const nodeReps = properties.orbitReps(cov, idcs0, chambers);
  const node2chamber = I.Map(I.Range().zip(nodeReps));
  const chamber2node = I.Map(
    nodeReps
      .zip(I.Range())
      .flatMap(p => properties.orbit(cov, idcs0, p[0]).zip(I.Repeat(p[1]))));

  const edges = properties.orbitReps(cov, _remainingIndices(cov, 1), chambers)
    .map(function(D) {
      const E = cov.s(0, D);
      const v = chamber2node.get(D);
      const w = chamber2node.get(E);
      const t = e2t.getIn([D, 0]) || zero;
      const sD = c2s.getIn([D, 0]);
      const sE = c2s.getIn([E, 0]);
      const s = V.minus(V.plus(t, sE), sD);

      return [v, w, s.data];
    });

  return {
    graph: periodic.make(edges),
    node2chamber: node2chamber,
    chamber2node: chamber2node
  };
};


const _chamberPositions = function _chamberPositions(cov, e2t, c2s, skel, pos) {
  const dim = delaney.dim(cov);
  let result = I.Map();

  cov.elements().forEach(function(D) {
    const p = pos.get(skel.chamber2node.get(D));
    const t = c2s.getIn([D, 0]);
    result = result.setIn([D, 0], V.plus(V.make(p), t));
  });

  I.Range(1, dim+1).forEach(function(i) {
    const idcs = I.Range(0, i);
    properties.orbitReps(cov, idcs, cov.elements()).forEach(function(D) {
      const orb = properties.orbit(cov, idcs, D);
      let s = V.constant(dim);
      orb.forEach(function(E) {
        const p = result.getIn([E, 0]);
        const t = c2s.getIn([E, i]);
        s = V.plus(s, V.minus(p, t));
      });
      s = V.scaled(F.div(1, orb.size), s);
      orb.forEach(function(E) {
        const t = c2s.getIn([E, i]);
        result = result.setIn([E, i], V.plus(s, t));
      });
   });
  });

  return result;
};


const _chamberBasis = function _chamberBasis(pos, D) {
  const t = pos.get(D).valueSeq();
  return M.make(I.Range(1, t.size).map(i => V.minus(t.get(i), t.get(0)).data));
};


const _symmetries = function _symmetries(ds, cov, pos) {
  const n = delaney.size(ds);
  const m = delaney.size(cov) / n;

  const D = ds.elements()
    .find(D => F.sgn(M.determinant(_chamberBasis(pos, D))) != 0);
  const A = M.inverse(_chamberBasis(pos, D));

  return I.Range(0, m).map(i => M.times(A, _chamberBasis(pos, D + i*n)));
};


const _resymmetrizedGramMatrix = function _resymmetrizedGramMatrix(G, syms) {
  let A = M.scaled(0, G);

  syms.forEach(S => {
    A = M.plus(A, M.times(S, M.times(G, M.transposed(S))));
  });

  A = M.scaled(F.div(1, syms.size), A);

  return A;
};


const _scalarProduct = function _scalarProduct(v, w, G) {
  const A = M.times(M.make([v.data]),
                    M.times(G, M.transposed(M.make([w.data]))));
  return M.get(A, 0, 0);
};


const _orthonormalBasis = function _orthonormalBasis(G) {
  const n = G.data.size;
  let e = M.identity(n).data.map(V.make);

  I.Range(0, n).forEach(function(i) {
    let v = e.get(i);
    I.Range(0, i).forEach(function(j) {
      const w = e.get(j);
      const f = _scalarProduct(v, w, G);
      v = V.minus(v, V.scaled(f, w));
    });
    const d = _scalarProduct(v, v, G);
    v = V.scaled(1/Math.sqrt(d), v);
    e = e.set(i, v);
  });

  return M.make(e.map(v => v.data));
};


const makeCover = ds =>
  delaney.dim(ds) == 3 ?
  delaney3d.pseudoToroidalCover(ds) :
  delaney2d.toroidalCover(ds);


export default function tiling(ds, cover) {
  const cov  = cover || makeCover(ds);
  const e2t  = _edgeTranslations(cov);
  const c2s  = _cornerShifts(cov, e2t);
  const skel = _skeleton(cov, e2t, c2s);
  const vpos = periodic.barycentricPlacementAsFloat(skel.graph);
  const pos  = _chamberPositions(cov, e2t, c2s, skel, vpos);
  const syms = _symmetries(ds, cov, pos);

  const G = _resymmetrizedGramMatrix(M.identity(delaney.dim(ds)), syms);
  const basis = M.inverse(_orthonormalBasis(G));

  return {
    cover       : cov,
    graph       : skel.graph,
    node2chamber: skel.node2chamber,
    chamber2node: skel.chamber2node,
    positions   : pos,
    symmetries  : syms,
    gramMatrix  : G,
    basis       : basis
  };
};


if (require.main == module) {
  const test = function test(ds) {
    console.log('ds = '+ds);
    console.log(tiling(ds));
    console.log();
  }

  test(delaney.parse('<1.1:3:1 2 3,1 3,2 3:4 8,3>'));
  test(delaney.parse('<1.1:1:1,1,1:6,3>'));
  test(delaney.parse('<1.1:8:2 4 6 8,8 3 5 7,6 5 8 7:4,4>'));
  test(delaney.parse('<1.1:8:2 4 6 8,8 3 5 7,5 6 8 7:4,4>'));
  test(delaney.parse('<1.1:1 3:1,1,1,1:4,3,4>'));
  test(delaney.parse('<1.1:2 3:2,1 2,1 2,2:6,3 2,6>'));
  test(delaney.parse('<1.1:2 3:1 2,1 2,1 2,2:3 3,3 4,4>'));
}
