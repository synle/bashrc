# assets/steamos

Vendored SteamOS / Steam Deck post-install assets used by
[`docs/steamos-setup.bash`](../../docs/steamos-setup.bash).

The zips are mirrored here so the setup helper downloads from this repo instead
of third-party release URLs that can move, get renamed, or disappear. Credit for
every artifact belongs to its original author — see the tables below for the
upstream repo and page each file came from.

Files are named `<org>_<component>[_v<version>].zip` (plugins) and
`<theme>_<themeId>.zip` (CSS Loader themes).

## Decky Loader plugins — `decky_plugin/`

| File in this repo | Repo | Repo URL |
| --- | --- | --- |
| `decky_plugin/xXJSONDeruloXx_decky-lsfg-vk_v0.14.4.zip` | `xXJSONDeruloXx/decky-lsfg-vk` | https://github.com/xXJSONDeruloXx/decky-lsfg-vk |
| `decky_plugin/hulkrelax_hltb-for-deck.zip` | `hulkrelax/hltb-for-deck` | https://github.com/hulkrelax/hltb-for-deck |
| `decky_plugin/SteamGridDB_decky-steamgriddb.zip` | `SteamGridDB/decky-steamgriddb` | https://github.com/SteamGridDB/decky-steamgriddb |
| `decky_plugin/suchmememanyskill_SDH-CssLoader.zip` | `suchmememanyskill/SDH-CssLoader` | https://github.com/suchmememanyskill/SDH-CssLoader |
| `decky_plugin/OMGDuke_protondb-decky.zip` | `OMGDuke/protondb-decky` | https://github.com/OMGDuke/protondb-decky |
| `decky_plugin/EmuDeck_EmuDecky.zip` | `EmuDeck/EmuDecky` | https://github.com/EmuDeck/EmuDecky |
| `decky_plugin/saumya-banthia_volume-boost.zip` | `saumya-banthia/volume-boost` | https://github.com/saumya-banthia/volume-boost |
| `decky_plugin/jurassicplayer_decky-autoflatpaks_v1.6.8.zip` | `jurassicplayer/decky-autoflatpaks` | https://github.com/jurassicplayer/decky-autoflatpaks |
| `decky_plugin/honjow_HueSync_v3.9.0.zip` | `honjow/HueSync` | https://github.com/honjow/HueSync |

SteamGridDB and Volume Boost are served from the Decky store CDN
(`cdn.tzatzikiweeb.moe`); their upstream repos are listed above for attribution.

## CSS Loader themes — `decky_css_loader/`

Themes come from the [DeckThemes](https://deckthemes.com/) store. Each file is
named `<theme>_<themeId>.zip`, where `<themeId>` is the DeckThemes theme id.

| File in this repo | Theme (author) | Theme URL |
| --- | --- | --- |
| `decky_css_loader/Round_c6844008-a809-41f6-b140-7aa76f2a62ad.zip` | Round (EMERALD) | https://deckthemes.com/themes/view?themeId=c6844008-a809-41f6-b140-7aa76f2a62ad |
| `decky_css_loader/Clean_Gameview_a9776f60-2724-4ff0-824b-e1f82a04688e.zip` | Clean Gameview (Sims) | https://deckthemes.com/themes/view?themeId=a9776f60-2724-4ff0-824b-e1f82a04688e |
| `decky_css_loader/Centered_Home_865407ae-fb14-4db7-b123-61f6995ed757.zip` | Centered Home (EMERALD) | https://deckthemes.com/themes/view?themeId=865407ae-fb14-4db7-b123-61f6995ed757 |
| `decky_css_loader/No_Home_Text_0e8a208f-136f-4f26-b0e1-344bcd186ed9.zip` | No Home Text (Joyboy) | https://deckthemes.com/themes/view?themeId=0e8a208f-136f-4f26-b0e1-344bcd186ed9 |
| `decky_css_loader/No_Home_Recent_Text_95c4e310-0770-4e1f-9f9d-cbe444e9bb17.zip` | No Home Recent Text (Leozito) | https://deckthemes.com/themes/view?themeId=95c4e310-0770-4e1f-9f9d-cbe444e9bb17 |
| `decky_css_loader/Obsidian_f16cf40d-7ccc-4981-95bf-77b28e8d101e.zip` | Obsidian (EMERALD) | https://deckthemes.com/themes/view?themeId=f16cf40d-7ccc-4981-95bf-77b28e8d101e |
| `decky_css_loader/Faster_Transition_Animations_921a7ec8-b355-4799-b23f-73f4b9c713b8.zip` | Faster Transition Animations (Sims) | https://deckthemes.com/themes/view?themeId=921a7ec8-b355-4799-b23f-73f4b9c713b8 |
| `decky_css_loader/Mini_Carousel_4788b3d9-f4f3-40f2-ae0e-a80afa9fce5b.zip` | Mini Carousel (levi) | https://deckthemes.com/themes/view?themeId=4788b3d9-f4f3-40f2-ae0e-a80afa9fce5b |
| `decky_css_loader/No_Home_Edge_Fade_2dab90ab-2cf3-480f-adce-f6c67caadd67.zip` | No Home Edge Fade (Sims) | https://deckthemes.com/themes/view?themeId=2dab90ab-2cf3-480f-adce-f6c67caadd67 |

## Misc — repo root

Files vendored at the repo root of `assets/steamos/`.

| File in this repo | What it is | Saved to on the Deck |
| --- | --- | --- |
| `sponsporblock.json` | SponsorBlock extension settings export (server, categories, bar colors) | `~/Desktop/sponsporblock.json` |
