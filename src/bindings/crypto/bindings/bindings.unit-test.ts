/**
 * This file exhaustively tests JS implementations of `pasta_bindings.ml` for consistency.
 * The TS impl is tested to be equivalent to the Rust/Wasm impl.
 *
 * "Equivalent" is defined as follows:
 * - They throw errors for the same inputs
 * - If they don't throw an error, outputs must be the same
 */
import {
  Bigint256,
  Bigint256Bindings,
  MlBytes,
  fromMlString,
  mlBytesFromUint8Array,
  mlBytesToUint8Array,
  toMlStringAscii,
} from './bigint256.js';
import { wasm } from '../../js/node/node-backend.js';
import { Spec, ToSpec, FromSpec, defaultAssertEqual, id } from '../../../lib/testing/equivalent.js';
import { Random } from '../../../lib/testing/property.js';
import {
  WasmAffine,
  WasmProjective,
  affineFromRust,
  affineToRust,
  fieldFromRust,
  fieldToRust,
} from './conversion-base.js';
import { equivalentRecord } from './test-utils.js';
import { Field, FpBindings, FqBindings } from './field.js';
import { MlBool, MlOption } from '../../../lib/ml/base.js';
import { OrInfinity, PallasBindings, VestaBindings, toMlOrInfinity } from './curve.js';
import { GroupProjective, Pallas, ProjectiveCurve, Vesta } from '../elliptic-curve.js';
import {
  WasmGPallas,
  WasmGVesta,
  WasmPallasGProjective,
  WasmVestaGProjective,
} from '../../compiled/node_bindings/plonk_wasm.cjs';
import { FiniteField, Fp, Fq } from '../finite-field.js';

let number: ToSpec<number, number> = { back: id };
let numberLessThan = (max: number): FromSpec<number, number> => ({
  rng: Random.nat(max - 1),
  there: id,
});
let uint31: Spec<number, number> = {
  rng: Random.nat(0x7fffffff),
  there: id,
  back: id,
};

let bigint256: Spec<Bigint256, Uint8Array> = {
  rng: Random.map(Random.biguint(256), (x) => [0, x]),
  there: fieldToRust,
  back: fieldFromRust,
};
let fp: Spec<Field, Uint8Array> = {
  rng: Random.map(Random.field, (x) => [0, x]),
  there: fieldToRust,
  back: fieldFromRust,
};
let fq: Spec<Field, Uint8Array> = {
  rng: Random.map(Random.scalar, (x) => [0, x]),
  there: fieldToRust,
  back: fieldFromRust,
};

let boolean: Spec<MlBool, boolean> = {
  rng: Random.map(Random.boolean, MlBool),
  there: Boolean,
  back: MlBool,
};
let decimalString: Spec<MlBytes, string> = {
  rng: Random.map(Random.json.field, toMlStringAscii),
  there: fromMlString,
  back: toMlStringAscii,
};
let bytes: Spec<MlBytes, Uint8Array> = {
  rng: Random.map(Random.bytes(32), mlBytesFromUint8Array),
  there: mlBytesToUint8Array,
  back: mlBytesFromUint8Array,
};

function option<T, S>(spec: Spec<T, S>): Spec<MlOption<T>, S | undefined> {
  return {
    rng: Random.map(Random.oneOf(spec.rng, undefined), (o) => MlOption(o)),
    there: (x) => MlOption.mapFrom(x, spec.there),
    back: (x) => MlOption.mapTo(x, spec.back),
  };
}

equivalentRecord(Bigint256Bindings as Omit<typeof Bigint256Bindings, "caml_bigint_256_print" | "caml_bigint_256_to_string">, wasm, {
  caml_bigint_256_of_numeral: undefined, // TODO
  caml_bigint_256_of_decimal_string: { from: [decimalString], to: bigint256 },
  caml_bigint_256_num_limbs: { from: [], to: number },
  caml_bigint_256_bytes_per_limb: { from: [], to: number },
  caml_bigint_256_div: { from: [bigint256, bigint256], to: bigint256 },
  caml_bigint_256_compare: { from: [bigint256, bigint256], to: number },
  caml_bigint_256_test_bit: {
    from: [bigint256, numberLessThan(256)],
    to: boolean,
  },
  caml_bigint_256_to_bytes: { from: [bigint256], to: bytes },
  caml_bigint_256_of_bytes: { from: [bytes], to: bigint256 },
  caml_bigint_256_deep_copy: { from: [bigint256], to: bigint256 },
});




// elliptic curve

let pallas = projective<WasmPallasGProjective, WasmGPallas>(
  Pallas,
  Fq,
  wasm.caml_pallas_affine_one,
  wasm.caml_pallas_of_affine,
  wasm.caml_pallas_to_affine
);
let pallasAffine = affine<WasmGPallas>(Pallas, Fq, wasm.caml_pallas_affine_one);

let vesta = projective<WasmVestaGProjective, WasmGVesta>(
  Vesta,
  Fp,
  wasm.caml_vesta_affine_one,
  wasm.caml_vesta_of_affine,
  wasm.caml_vesta_to_affine
);
let vestaAffine = affine<WasmGVesta>(Vesta, Fp, wasm.caml_vesta_affine_one);

equivalentRecord(PallasBindings, wasm, {
  caml_pallas_one: { from: [], to: pallas },
  caml_pallas_add: { from: [pallas, pallas], to: pallas },
  caml_pallas_sub: { from: [pallas, pallas], to: pallas },
  caml_pallas_negate: { from: [pallas], to: pallas },
  caml_pallas_double: { from: [pallas], to: pallas },
  caml_pallas_scale: { from: [pallas, fq], to: pallas },
  caml_pallas_random: undefined, // random outputs won't match
  caml_pallas_rng: undefined, // random outputs won't match
  caml_pallas_endo_base: { from: [], to: fp },
  caml_pallas_endo_scalar: { from: [], to: fq },
  caml_pallas_to_affine: { from: [pallas], to: pallasAffine },
  caml_pallas_of_affine: { from: [pallasAffine], to: pallas },
  caml_pallas_of_affine_coordinates: { from: [fp, fp], to: pallas },
  caml_pallas_affine_deep_copy: { from: [pallasAffine], to: pallasAffine },
});

equivalentRecord(VestaBindings, wasm, {
  caml_vesta_one: { from: [], to: vesta },
  caml_vesta_add: { from: [vesta, vesta], to: vesta },
  caml_vesta_sub: { from: [vesta, vesta], to: vesta },
  caml_vesta_negate: { from: [vesta], to: vesta },
  caml_vesta_double: { from: [vesta], to: vesta },
  caml_vesta_scale: { from: [vesta, fp], to: vesta },
  caml_vesta_random: undefined, // random outputs won't match
  caml_vesta_rng: undefined, // random outputs won't match
  caml_vesta_endo_base: { from: [], to: fq },
  caml_vesta_endo_scalar: { from: [], to: fp },
  caml_vesta_to_affine: { from: [vesta], to: vestaAffine },
  caml_vesta_of_affine: { from: [vestaAffine], to: vesta },
  caml_vesta_of_affine_coordinates: { from: [fq, fq], to: vesta },
  caml_vesta_affine_deep_copy: { from: [vestaAffine], to: vestaAffine },
});

function projective<WasmP extends WasmProjective, WasmA extends WasmAffine>(
  Curve: ProjectiveCurve,
  Scalar: FiniteField,
  affineOne: () => WasmA,
  projOfAffine: (a: WasmA) => WasmP,
  projToAffine: (p: WasmP) => WasmA
): Spec<GroupProjective, WasmP> {
  let randomScaled = Random(() => Curve.scale(Curve.one, Scalar.random()));

  return {
    rng: Random.oneOf(Curve.zero, Curve.one, randomScaled, randomScaled, randomScaled),
    // excessively expensive to work around limited Rust API - only use for tests
    there(p: GroupProjective): WasmP {
      let { x, y, infinity } = Curve.toAffine(p);
      let pAffineRust = affineOne();
      if (infinity) {
        pAffineRust.infinity = true;
      } else {
        pAffineRust.x = fieldToRust([0, x]);
        pAffineRust.y = fieldToRust([0, y]);
      }
      return projOfAffine(pAffineRust);
    },
    back(p: WasmP): GroupProjective {
      let pAffineRust = projToAffine(p);
      if (pAffineRust.infinity) {
        pAffineRust.free();
        return Curve.zero;
      } else {
        let [, x] = fieldFromRust(pAffineRust.x);
        let [, y] = fieldFromRust(pAffineRust.y);
        return Curve.fromAffine({ x, y, infinity: false });
      }
    },
    // we have to relax equality since we always normalize Rust points for conversion,
    // but TS points are not normalized
    assertEqual(g, h, message) {
      defaultAssertEqual(Curve.equal(g, h), true, message);
    },
  };
}

function affine<WasmA extends WasmAffine>(
  Curve: ProjectiveCurve,
  Scalar: FiniteField,
  affineOne: () => WasmA
): Spec<OrInfinity, WasmA> {
  let randomScaled = Random(() => Curve.scale(Curve.one, Scalar.random()));
  let rngProjective = Random.oneOf(Curve.zero, Curve.one, randomScaled, randomScaled, randomScaled);
  let rng = Random.map(rngProjective, (p) => toMlOrInfinity(Curve.toAffine(p)));

  return {
    rng,
    there: (p: OrInfinity) => affineToRust(p, affineOne),
    back: affineFromRust,
  };
}
