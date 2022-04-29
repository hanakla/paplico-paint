// const rgb2Hsl_func = `
// const float _rgb2Hsl_EPSILON = 1e-10;

// // SEE: https://www.shadertoy.com/view/4dKcWK
// vec3 _silk_rgbToHcv(in vec3 rgb)
// {
//     // RGB [0..1] to Hue-Chroma-Value [0..1]
//     // Based on work by Sam Hocevar and Emil Persson
//     vec4 p = (rgb.g < rgb.b) ? vec4(rgb.bg, -1., 2. / 3.) : vec4(rgb.gb, 0., -1. / 3.);
//     vec4 q = (rgb.r < p.x) ? vec4(p.xyw, rgb.r) : vec4(rgb.r, p.yzx);
//     float c = q.x - min(q.w, q.y);
//     float h = abs((q.w - q.y) / (6. * c + _rgb2Hsl_EPSILON) + q.z);
//     return vec3(h, c, q.x);
// }

// vec3 rgbToHsl(in vec3 rgb)
// {
//     // RGB [0..1] to Hue-Saturation-Lightness [0..1]
//     vec3 hcv = _silk_rgbToHcv(rgb);
//     float z = hcv.z - hcv.y * 0.5;
//     float s = hcv.y / (1. - abs(z * 2. - 1.) + _rgb2Hsl_EPSILON);
//     return vec3(hcv.x, s, z);
// }
// `

// const hsl2Rgb_func = `
// // SEE: https://www.shadertoy.com/view/4dKcWK
// vec3 _silk_hueToRgb(in float hue)
// {
//     // Hue [0..1] to RGB [0..1]
//     // See http://www.chilliant.com/rgb2hsv.html
//     vec3 rgb = abs(hue * 6. - vec3(3, 2, 4)) * vec3(1, -1, -1) + vec3(-1, 2, 2);
//     return clamp(rgb, 0., 1.);
// }

// vec3 hsl2Rgb(in vec3 hsl)
// {
//     // Hue-Saturation-Lightness [0..1] to RGB [0..1]
//     vec3 rgb = _silk_hueToRgb(hsl.x);
//     float c = (1. - abs(2. * hsl.z - 1.)) * hsl.y;
//     return (rgb - 0.5) * c + hsl.z;
// }
// `

// export const hnklMultiplyMix_func = `
// ${rgb2Hsl_func}
// ${hsl2Rgb_func}

// vec4 hnklMultiplyMix(vec4 fore, vec4 back) {
//   // SEE: https://odashi.hatenablog.com/entry/20110921/1316610121

//   float a1 = fore.a * back.a;
//   float a2 = fore.a * (1.0 - back.a);
//   float a3 = (1.0 - fore.a) * back.a;
//   float alpha = a1 + a2 + a3;

//   vec3 multi = (fore * back).rgb;
//   vec3 fHsl = rgbToHsl(fore.rgb);
//   vec3 bHsl = rgbToHsl(back.rgb);
//   vec3 rHsl = rgbToHsl(multi.rgb);

//   vec3 cr = vec3(
//     rHsl.x,
//     rHsl.y + mix(max(.2, rHsl.z, .2),
//     fHsl.z * bHsl.z
//   );

//   vec3 result = (cr * a1 + fore.rgb * a2 + back.rgb * a3) / alpha;

//   return vec4(result, alpha);
// }
// `

export const multiplyMix_func = `
vec4 multiplyMix(vec4 fore, vec4 back) {
  // SEE: https://odashi.hatenablog.com/entry/20110921/1316610121

  float a1 = fore.a * back.a;
  float a2 = fore.a * (1.0 - back.a);
  float a3 = (1.0 - fore.a) * back.a;
  float alpha = a1 + a2 + a3;

  vec3 cr = (fore * back).rgb;
  vec3 result = (cr * a1 + fore.rgb * a2 + back.rgb * a3) / alpha;

  return vec4(result, alpha);
}
`

export const screenMix_func = `
vec4 screenMix(vec4 fore, vec4 back) {
  // SEE: https://odashi.hatenablog.com/entry/20110921/1316610121

  float a1 = fore.a * back.a;
  float a2 = fore.a * (1.0 - back.a);
  float a3 = (1.0 - fore.a) * back.a;
  float alpha = (a1 + a2 + a3);

  vec3 cr = ((fore + back) - (fore * back)).rgb;
  vec3 result = (cr * a1 + fore.rgb * a2 + back.rgb * a3) / alpha;

  return vec4(result, alpha);
}
`
