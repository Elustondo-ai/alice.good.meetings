# Vendored avatar files (SPRINT-004, AV-7)

Downloaded on 21 November 2026 with Pablo's approval and pinned to the versions below. Nothing is loaded from a CDN; the page asks only its own origin. Licence files sit beside each group. `poc/avatar.js` is the only code that loads these.

| Group | Source and pin | Licence |
| --- | --- | --- |
| `talkinghead/` | TalkingHead v1.8.2, https://github.com/met4citizen/TalkingHead (tag `v1.8.2`, files `modules/talkinghead.mjs`, `dynamicbones.mjs`, `retargeter.mjs`, `lipsync-en.mjs` and `LICENSE`, fetched from raw.githubusercontent.com) | MIT, `talkinghead/LICENSE` |
| `three/` | three 0.187.0 from npm (`npm pack three@0.187.0`): `build/three.module.js`, `build/three.core.js` and the twelve `examples/jsm` files that TalkingHead imports, with the package's `LICENSE` | MIT, `three/LICENSE` |
| `models/mpfb.glb` | TalkingHead v1.8.2 `avatars/mpfb.glb`, 36,815,920 bytes | CC0, `models/mpfb.LICENSE.txt` (a note recording the library README's statement) |

Not vendored on purpose: `playback-worklet.js` (used only for streamed speech, which Alice never plays), the other languages' lip-sync modules and the other example avatars. Draco decoding is off in TalkingHead by default, so no decoder is fetched.

## SHA-256

| File | Bytes | SHA-256 |
| --- | --- | --- |
| `models/mpfb.LICENSE.txt` | 514 | `a206fa83f32f5ebacb2c7fdee1d21e6ca5f78876623539c319eef3dc27688e41` |
| `models/mpfb.glb` | 36,815,920 | `63c645a2a863b9972e9a9c2ed576a1de4c390b8475508e1473e69c87a3ee299c` |
| `talkinghead/LICENSE` | 1,075 | `a168d1f90b70b313fb594ddb07e03c9dea08fe2a43df2b4f607db6920ce69cfa` |
| `talkinghead/dynamicbones.mjs` | 33,959 | `e3e754a8c4296b470a763be3705694d10dfa00cb7a0b311fa6d4751297ab8d82` |
| `talkinghead/lipsync-en.mjs` | 18,070 | `675c5e5a812fac0f378ce37a659d5e35b4968095aa1a991e0045509403e54ca5` |
| `talkinghead/retargeter.mjs` | 9,646 | `aae6954f90f35263d6116737b3e34a202f3f1430ffd1ce1368f7af7d2e8774cd` |
| `talkinghead/talkinghead.mjs` | 219,509 | `2580bfb965f432e3c6eed0115417d5a2814f4ad0689e031a0977122b42817f6b` |
| `three/LICENSE` | 1,081 | `8b378ebe60e2fe500158cb0ac71cb5e8b7d92953c2abcc63a0eb90499653b5bc` |
| `three/build/three.core.js` | 1,474,799 | `613e370f76638fdef83926642bf256dc9615684922de1ce1f63a8583e5d78578` |
| `three/build/three.module.js` | 658,900 | `104f56145899722094556490d787aae0617cc2fc3382f31df02d724ea1aee341` |
| `three/examples/jsm/controls/OrbitControls.js` | 40,918 | `e7fca2fe9e7670a828af9b28084669a5909445b7f36f1f26cee9bf8f2961c32c` |
| `three/examples/jsm/curves/NURBSCurve.js` | 4,157 | `f5aaeff3ed9b659c3d9c599878ede3106d93665e3243e502a09375f2edaed7fa` |
| `three/examples/jsm/curves/NURBSUtils.js` | 10,802 | `c6bd7c4137d585098923f189687898ea3e8762ea3ecbe255d749a56353894379` |
| `three/examples/jsm/environments/RoomEnvironment.js` | 4,960 | `55f466192cc84298755a424c5e040345006b2ee1455589b3b54126c2ea4123f4` |
| `three/examples/jsm/libs/fflate.module.js` | 91,108 | `4ab9828cf361a8009b71094ea251e076168de20f72eaa1e745da8aba88c725ac` |
| `three/examples/jsm/libs/meshopt_decoder.module.js` | 29,256 | `d428e73a000057c6c94bfcedc3412d0c2dc14ca8800e88553aab05113ad2bf19` |
| `three/examples/jsm/libs/stats.module.js` | 3,514 | `2c71a2f70e89c69e46c2e285fb171bac3dcfd498a85400e94ad5aaf6044ffc06` |
| `three/examples/jsm/loaders/DRACOLoader.js` | 19,155 | `344684542690b7381d86970bbc428a87c89293730f9e9ec8be592b9e5b3263a9` |
| `three/examples/jsm/loaders/FBXLoader.js` | 113,530 | `04daa9a7054f17838b78a114e7d400c05d08d72afa7b62f2fc1d508909a6df3c` |
| `three/examples/jsm/loaders/GLTFLoader.js` | 119,861 | `532ac726e120039acbcd6cf54328c57acbf7b438176afaa6951257126d11bff1` |
| `three/examples/jsm/utils/BufferGeometryUtils.js` | 39,153 | `7bda2a8ba836b2bcf67cb938d4b9e1bb5d1b1bc616817103ed858c0b58296ce7` |
| `three/examples/jsm/utils/SkeletonUtils.js` | 11,535 | `b1632a703206c3d830de9fcbe515696770d04b71a15ee6b50afa6d2c3298c86f` |

The hashes are of the files as downloaded, unchanged. Return to the [POC README](../README.md).
