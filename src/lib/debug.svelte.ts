/** Reactive debug tunables — only used in dev mode. */

// ── Edge bloom ──────────────────────────────────────────
let intensity = $state(0.2);
let radius = $state(80);
let gamma = $state(0.5);

export const edgeBloom = {
	get intensity() { return intensity; },
	set intensity(v: number) { intensity = v; },
	get radius() { return radius; },
	set radius(v: number) { radius = v; },
	get gamma() { return gamma; },
	set gamma(v: number) { gamma = v; },
};

// ── Typography & spacing (all rem) ──────────────────────
// Six tiers: base (<640) → sm (640) → md (768) → lg (1024) → xl (1280) → 2xl (1536)
// Breakpoint keys: '' (base), Sm, Md, Lg, Xl, 2xl

// Shared brow (verdict question + timer eyebrow)
//                          base    sm      md      lg      xl      2xl
let browSize =    $state(0.75);
let browSizeSm =  $state(0.688);
let browSizeMd =  $state(0.75);
let browSizeLg =  $state(0.813);
let browSizeXl =  $state(0.875);
let browSize2xl = $state(0.875);
let browMb =      $state(0.3);
let browMbSm =    $state(0.375);
let browMbMd =    $state(0.4);
let browMbLg =    $state(0.45);
let browMbXl =    $state(0.475);
let browMb2xl =   $state(0.5);

// Shared heading (verdict + timer)
let headingSize =    $state(1.625);
let headingSizeSm =  $state(1.375);
let headingSizeMd =  $state(1.625);
let headingSizeLg =  $state(2.0);
let headingSizeXl =  $state(2.75);
let headingSize2xl = $state(3.0);

// CopyText
let copySize =    $state(1.0);
let copySizeSm =  $state(0.875);
let copySizeMd =  $state(0.875);
let copySizeLg =  $state(1.0);
let copySizeXl =  $state(1.125);
let copySize2xl = $state(1.25);

// StatusBar padding
let barPx =    $state(2.0);
let barPy =    $state(2.0);
let barGap =   $state(1.0);
let barPxSm =  $state(2.25);
let barPySm =  $state(2.25);
let barGapSm = $state(1.0);
let barPxMd =  $state(2.375);
let barPyMd =  $state(2.375);
let barGapMd = $state(1.25);
let barPxLg =  $state(2.75);
let barPyLg =  $state(2.75);
let barGapLg = $state(1.5);
let barPxXl =  $state(3.0);
let barPyXl =  $state(3.0);
let barGapXl = $state(1.625);
let barPx2xl =  $state(3.125);
let barPy2xl =  $state(3.125);
let barGap2xl = $state(1.75);

export const typography = {
	brow: {
		get size() { return browSize; }, set size(v: number) { browSize = v; },
		get sizeSm() { return browSizeSm; }, set sizeSm(v: number) { browSizeSm = v; },
		get sizeMd() { return browSizeMd; }, set sizeMd(v: number) { browSizeMd = v; },
		get sizeLg() { return browSizeLg; }, set sizeLg(v: number) { browSizeLg = v; },
		get sizeXl() { return browSizeXl; }, set sizeXl(v: number) { browSizeXl = v; },
		get size2xl() { return browSize2xl; }, set size2xl(v: number) { browSize2xl = v; },
		get mb() { return browMb; }, set mb(v: number) { browMb = v; },
		get mbSm() { return browMbSm; }, set mbSm(v: number) { browMbSm = v; },
		get mbMd() { return browMbMd; }, set mbMd(v: number) { browMbMd = v; },
		get mbLg() { return browMbLg; }, set mbLg(v: number) { browMbLg = v; },
		get mbXl() { return browMbXl; }, set mbXl(v: number) { browMbXl = v; },
		get mb2xl() { return browMb2xl; }, set mb2xl(v: number) { browMb2xl = v; },
	},
	heading: {
		get size() { return headingSize; }, set size(v: number) { headingSize = v; },
		get sizeSm() { return headingSizeSm; }, set sizeSm(v: number) { headingSizeSm = v; },
		get sizeMd() { return headingSizeMd; }, set sizeMd(v: number) { headingSizeMd = v; },
		get sizeLg() { return headingSizeLg; }, set sizeLg(v: number) { headingSizeLg = v; },
		get sizeXl() { return headingSizeXl; }, set sizeXl(v: number) { headingSizeXl = v; },
		get size2xl() { return headingSize2xl; }, set size2xl(v: number) { headingSize2xl = v; },
	},
	copy: {
		get size() { return copySize; }, set size(v: number) { copySize = v; },
		get sizeSm() { return copySizeSm; }, set sizeSm(v: number) { copySizeSm = v; },
		get sizeMd() { return copySizeMd; }, set sizeMd(v: number) { copySizeMd = v; },
		get sizeLg() { return copySizeLg; }, set sizeLg(v: number) { copySizeLg = v; },
		get sizeXl() { return copySizeXl; }, set sizeXl(v: number) { copySizeXl = v; },
		get size2xl() { return copySize2xl; }, set size2xl(v: number) { copySize2xl = v; },
	},
	bar: {
		get px() { return barPx; }, set px(v: number) { barPx = v; },
		get py() { return barPy; }, set py(v: number) { barPy = v; },
		get gap() { return barGap; }, set gap(v: number) { barGap = v; },
		get pxSm() { return barPxSm; }, set pxSm(v: number) { barPxSm = v; },
		get pySm() { return barPySm; }, set pySm(v: number) { barPySm = v; },
		get gapSm() { return barGapSm; }, set gapSm(v: number) { barGapSm = v; },
		get pxMd() { return barPxMd; }, set pxMd(v: number) { barPxMd = v; },
		get pyMd() { return barPyMd; }, set pyMd(v: number) { barPyMd = v; },
		get gapMd() { return barGapMd; }, set gapMd(v: number) { barGapMd = v; },
		get pxLg() { return barPxLg; }, set pxLg(v: number) { barPxLg = v; },
		get pyLg() { return barPyLg; }, set pyLg(v: number) { barPyLg = v; },
		get gapLg() { return barGapLg; }, set gapLg(v: number) { barGapLg = v; },
		get pxXl() { return barPxXl; }, set pxXl(v: number) { barPxXl = v; },
		get pyXl() { return barPyXl; }, set pyXl(v: number) { barPyXl = v; },
		get gapXl() { return barGapXl; }, set gapXl(v: number) { barGapXl = v; },
		get px2xl() { return barPx2xl; }, set px2xl(v: number) { barPx2xl = v; },
		get py2xl() { return barPy2xl; }, set py2xl(v: number) { barPy2xl = v; },
		get gap2xl() { return barGap2xl; }, set gap2xl(v: number) { barGap2xl = v; },
	},
};
