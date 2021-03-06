import {
  coordinateChangesQ as opsQ,
  coordinateChangesF as opsF
} from '../geometry/types';


export const mapGramMatrix = (transform, gram) => {
  const M = opsF.inverse(opsF.linearPart(transform.oldToNew));
  return opsF.times(opsF.transposed(M), opsF.times(gram, M));
};


export const invariantBasis = gram => {
  const dot = (v, w) => opsF.times(opsF.times(v, gram), w);

  const vs = opsF.identityMatrix(gram.length);
  const ortho = [];

  for (let v of vs) {
    for (const w of ortho)
      v = opsF.minus(v, opsF.times(w, dot(v, w)));
    ortho.push(opsF.div(v, opsF.sqrt(dot(v, v))))
  }

  // by construction, the following produces the inverse of ortho
  return opsF.times(gram, opsF.transposed(ortho));
};


export const symmetrizedGramMatrix = (gram, symOps) => {
  let M = opsF.times(0, gram);

  for (const sym of symOps) {
    const S = opsQ.toJS(opsQ.linearPart(sym));
    M = opsF.plus(M, opsF.times(S, opsF.times(gram, opsF.transposed(S))));
  }

  return opsF.div(M, symOps.length);
};


export const unitCellParameters = gram => {
  const eps = Math.pow(2, -50);
  const trim = x => Math.abs(x) < eps ? 0 : x;
  const acosdeg = x => Math.acos(x) / Math.PI * 180.0;

  if (gram.length == 1) {
    return [trim(Math.sqrt(gram[0][0]))];
  }
  else if (gram.length == 2) {
    const a = Math.sqrt(gram[0][0]);
    const b = Math.sqrt(gram[1][1]);
    return [a, b, acosdeg(gram[0][1] / a / b)].map(trim);
  }
  else if (gram.length == 3) {
    const a = Math.sqrt(gram[0][0]);
    const b = Math.sqrt(gram[1][1]);
    const c = Math.sqrt(gram[2][2]);
    const alpha = acosdeg(gram[1][2] / b / c);
    const beta  = acosdeg(gram[0][2] / a / c);
    const gamma = acosdeg(gram[0][1] / a / b);
    return [a, b, c, alpha, beta, gamma].map(trim);
  }
};


export const unitCellVolume = gram => Math.sqrt(opsF.determinant(gram));
