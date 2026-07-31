# Stitch Screen Map

This file is the immutable visual baseline for the Private Rollup app. Do not edit the source Stitch export files in `../stitch_file_driven_design_system`; convert them into React components inside this app instead.

## Route Mapping

| Stitch screen | App route | Purpose |
| --- | --- | --- |
| `landing_page_private_rollup` | `/` | Public entry and wallet CTA |
| `dashboard_private_rollup` | `/app` | Dashboard overview |
| `upload_private_rollup` | `/app/upload` | Single-file and folder upload |
| `chi_ti_t_pack_private_rollup` | `/app/packs/[packId]` | Pack detail |
| `ph_c_h_i_private_rollup` | `/app/recovery` | Recovery and CLI guidance |

`/app/packs` will be derived from the dashboard and pack-detail visual language because Stitch does not include a standalone pack-list screen.

## Excluded Stitch Controls

These Stitch affordances are explicitly out of MVP scope and must not be carried into the functional app:

| Control or asset | Decision |
| --- | --- |
| `Renew Lease` | Exclude. MVP does not support renewal or paid retention extension. |
| `Copy KZG` | Exclude. Local Shelby notes use Clay encoding, blob Merkle roots, chunkset commitments, Aptos coordination, and hot object storage; KZG wording is unsupported here. |
| Web download/decrypt controls | Exclude. Retrieval and decryption must happen through local CLI. |
| `Material Symbols` | Replace with Lucide icons in React components. |
| `href="#"` links | Replace with real routes, buttons, disabled controls with reasons, or remove. |

## Hash Manifest

| Source path | SHA-256 |
| --- | --- |
| `stitch_file_driven_design_system/stitch_file_driven_design_system/landing_page_private_rollup/code.html` | `850006177babdf6ffe27e571fc8b0e4b68e61277a169e7d97065629638619d82` |
| `stitch_file_driven_design_system/stitch_file_driven_design_system/landing_page_private_rollup/screen.png` | `0da8c3921c9676420b45a05ca67f6a7b462db7cad2ad52ee590dd51c1064d385` |
| `stitch_file_driven_design_system/stitch_file_driven_design_system/dashboard_private_rollup/code.html` | `7ee1bd61012148163e05083b794cb4e0bd422e35dcc8003130f37d8065fa6238` |
| `stitch_file_driven_design_system/stitch_file_driven_design_system/dashboard_private_rollup/screen.png` | `a90326ddef70ee59031765f9e1e308f8698dfc34bfbf1d925e006306886ef241` |
| `stitch_file_driven_design_system/stitch_file_driven_design_system/upload_private_rollup/code.html` | `c8b9a4373e4b741a494ce175693fa8cba5ed995de6a189e9b33c2dc7397e90d3` |
| `stitch_file_driven_design_system/stitch_file_driven_design_system/upload_private_rollup/screen.png` | `a1adf531d53c6930d2cbca98ba3e642e870133e5bab21284fb3b5ea2d744ccfe` |
| `stitch_file_driven_design_system/stitch_file_driven_design_system/chi_ti_t_pack_private_rollup/code.html` | `9e51ebbbf536b62b5a4a4a901d6793f360a5826d6d4f915f4ce8f54e838664b5` |
| `stitch_file_driven_design_system/stitch_file_driven_design_system/chi_ti_t_pack_private_rollup/screen.png` | `8a9176a7c141b04829a8ec83512530470f248f1889b58e382c1db56b8d750422` |
| `stitch_file_driven_design_system/stitch_file_driven_design_system/ph_c_h_i_private_rollup/code.html` | `cbf1a393f8adb0d1c6fb65f74d7b36f05d28855a6957a9c5f7733e6ec3c7c8e3` |
| `stitch_file_driven_design_system/stitch_file_driven_design_system/ph_c_h_i_private_rollup/screen.png` | `c646d45ab27f59c429116895d179225589892192eafcdf08fa5b7fc5f8ede7a4` |
| `stitch_file_driven_design_system/stitch_file_driven_design_system/private_rollup/DESIGN.md` | `fbb1a3ea0470392c7e5b4b64aade7bd39e36014227f71796d6ebbaa503723667` |
