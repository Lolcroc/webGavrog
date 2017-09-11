export const extend = (matrixOps, eps=Math.pow(2, -50)) => {
  const ops = matrixOps;


  const _cleanupRow = v => {
    const sup = v.reduce((a, x) => ops.gt(ops.abs(x), a) ? ops.abs(x) : a, 0);
    const delta = ops.times(sup, eps);
    return v.map(x => ops.gt(ops.abs(x), delta) ? x : 0);
  };


  const extendBasis = (v, bs) => {
    if (bs && bs.length)
      bs = bs.slice();

    for (const row in bs || []) {
      let b = bs[row];
      const colB = b.findIndex(x => ops.ne(x, 0));
      const colV = v.findIndex(x => ops.ne(x, 0));

      if (v.length != b.length)
        throw Error("shapes don't match");

      if (colV < colB) {
        if (colV >= 0)
          bs.splice(row, 0, (bs.length - row) % 2 ? ops.negative(v) : v);
        return bs;
      }
      else if (colV == colB) {
        if (ops.abs(v[colV]) > ops.abs(b[colV])) {
          [b, v] = [v, ops.negative(b)];
          bs[row] = b;
        }
        v = _cleanupRow(ops.minus(v, ops.times(b, ops.div(v[colV], b[colV]))));
      }
    }

    return ops.sgn(v) == 0 ? bs : (bs || []).concat([v]);
  };


  const triangularBasis = rows => {
    let bs = null;
    for (const v of rows)
      bs = extendBasis(v, bs);
    return bs;
  };


  const rank = rows => {
    const bs = triangularBasis(rows);
    return bs == null ? 0 : bs.length;
  };


  const determinant = rows => {
    const [nrows, ncols] = ops.shape(rows);
    if (nrows != ncols)
      throw new Error('must be a square matrix');

    const bs = triangularBasis(rows);

    if (bs == null || bs.length < nrows)
      return 0;
    else
      return bs.map((v, i) => v[i]).reduce((a, x) => ops.times(a, x));
  };


  const reducedBasis = (mat, right=null) => {
    const div = ops.div;
    const t = right == null ? mat : mat.map((v, i) => v.concat(right[i]));
    const bs = triangularBasis(t);

    if (bs == null)
      return right == null ? null : [null, null];

    let col = 0;
    for (let row = 0; row < bs.length; ++row) {
      while (ops.eq(bs[row][col], 0))
        ++col;

      if (ops.lt(bs[row][col], 0))
        bs[row] = ops.negative(bs[row]);

      if (ops.ne(bs[row][col], 1))
        bs[row] = div(bs[row], bs[row][col]);

      const p = bs[row][col];

      for (let i = 0; i < row; ++i)
        bs[i] = ops.minus(bs[i], ops.times(bs[row], div(bs[i][col], p)));
    }

    if (right == null)
      return bs;
    else {
      const [n, m] = ops.shape(mat);
      return [bs.map(v => v.slice(0, m)), bs.map(v => v.slice(m))];
    }
  };


  const solve = (lft, rgt) => {
    const [rowsLft, colsLft] = ops.shape(lft);
    const [rowsRgt, colsRgt] = ops.shape(rgt);
    if (rowsLft != rowsRgt)
      throw new Error('left and right side must have equal number of rows');

    [lft, rgt] = reducedBasis(lft, rgt);

    if (lft == null)
      return ops.matrix(colsLft, colsRgt);
    else if (rank(lft) < lft.length)
      return null;

    const [n, m] = ops.shape(lft);
    const [B, U] = reducedBasis(ops.transposed(lft), ops.identityMatrix(m))
      .map(t => ops.transposed(t));

    const y = [];
    for (const i in rgt) {
      const v = ops.minus(rgt[i], ops.times(B[i].slice(0, i), y));
      y.push(v.map(x => ops.div(x, B[i][i])));
    }

    return ops.times(U, y.concat(ops.matrix(m - n, y[0].length)));
  };


  const leftNullSpace = mat => {
    const [nrows, ncols] = ops.shape(mat);
    const [lft, rgt] = reducedBasis(mat, ops.identityMatrix(nrows));
    const k = lft.findIndex(v => v.every(x => ops.eq(x, 0)));

    if (k >= 0)
      return rgt.slice(k);
    else
      return null;
  };


  const nullSpace = mat => {
    const lns = leftNullSpace(ops.transposed(mat));
    if (lns == null)
      return null;
    else
      return ops.transposed(lns);
  };


  const methods = {
    extendBasis: {
      Vector: {
        Null: extendBasis,
        Matrix: extendBasis
      }
    },

    triangularBasis: {
      Null: _ => null,
      Matrix: triangularBasis
    },

    reducedBasis: {
      Null: _ => null,
      Matrix: reducedBasis
    },

    rank: {
      Null: _ => 0,
      Matrix: rank
    },

    determinant: {
      Null: _ => 0,
      Matrix: determinant
    },

    solve: {
      Matrix: {
        Matrix: (lft, rgt) => solve(lft, rgt)
      }
    },

    inverse: {
      Null: _ => null,
      Matrix: mat => solve(mat, ops.identityMatrix(mat.length))
    },

    leftNullSpace: {
      Null: _ => null,
      Matrix: leftNullSpace
    },

    nullSpace: {
      Null: _ => null,
      Matrix: nullSpace
    },

    transposed: {
      Null: _ => null
    }
  };


  return ops.register(methods);
};


if (require.main == module) {
  Array.prototype.toString = function() {
    return '[ ' + this.map(x => x.toString()).join(', ') + ' ]';
  };

  const ops = require('./types').numericalLinearAlgebra;

  const test = (A, v) => {
    const b = ops.times(A, v);

    console.log(`A = ${A}`);
    console.log(`v = ${v}`);
    console.log(`b := A * v = ${b}`);

    const x = ops.solve(A, b);
    console.log(`A * x = b ~> x = ${x}`);
    console.log(`check A * x: ${ops.times(A, x)}`);
    console.log(`nullspace: ${ops.transposed(ops.nullSpace(A))}`);

    console.log();
  };

  test([[6,3],[0,5]], [[2],[3]]);
  test([[5,1,2],[10,8,5],[5,7,3]], [[3],[7],[0]]);
  test([[5,1,2],[10,8,5],[5,7,3]], [[ops.div(3, 5)],[7],[0]]);
  test([[0,0,0],[ 0,0,0],[0,0,0]], [[0],[0],[0]]);
}
