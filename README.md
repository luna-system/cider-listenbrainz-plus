# ListenBrainz Plus (Cider Plugin)

## (Requires Cider 2.5 or later)

## Provenance

__This codebase was authored by humans with assistance from generative AI tools. We dedicate it to the public domain under CC0; see LICENSE for details.__

## What is this?

-- human non-generated text begins --

Hi! We're [luna \<luna@airsi.de\>](https://luna.airsi.de/)! We used generative AI to write this plugin. We do not know how to write plugins for Cider, we don't have the capability to relearn JS right now, we don't have a working knowledge of Typescript, and the Cider documentation isn't very robust at the moment. We might be learning Vue as part of this process, which is a cool bonus.

We had a specific task we wanted to accomplish as the year came to a close: a sort of Spotify Wrapped but handmade, because we don't use Spotify but we do scrobble our listens. Unfortunately, while working on a script to gather all 2025 releases that we listened to this year, we found that the Cider plugin we'd been using doesn't scrobble a MusicBrainz ID. If it did, however, then our year-in-music script would be a lot easier, and wouldn't require smashing the MusicBrainz API with thousands of metadata lookups all at once at the end of the year.

Why all this detail? Because we didn't think that this would work. We didn't think that LLMs were robust enough for this kind of language processing. We had access to an "AI assistant" plugin as part of a software trial, and we wanted to know how it worked. Now here we are. It works, we're using it, and we're somewhat impressed by it. We want to offer this software to the void in case some poor fool might find it useful, or better, it might fall into more capable hands so it can be made better than we can make it.

We also offer this as a media literacy project. Prior to this project, we had no clue what coding models were capable of, and we encourage everyone - opponents as well as proponents - to research what is possible. For some it may sway how you feel somewhat, and for others it will reasonably solidify your hatred and/or fear. We understand both of these positions and have no clear position ourself yet. We look at this repo of code in what we can only describe as a "terrified awe". If we all don't manage to wrestle control of LLMs and forward-thinking software ideas away from the corporations, they will use it to crush every one of us.

This plugin adds ListenBrainz scrobbling to Cider. While there are other similar working plugins for Cider, this plugin also enriches scrobbles with a MusicBrainz ID. Furthermore, there are frameworks in place to extend scrobbles to add arbitrary data. For example, we plan to add the release year to the `additional_info` section of the ListenBrainz payload, making year-end recaps simple.

## UX Philosophy

- Where possible, all features are optional.
- Where possible, all features are transparent in how they operate.
- We make use of Cider's custom pages feature to add an "Advanced" page that gives transparent views of much of the processing done by this plugin's services
- Logging and debug data are hidden and not rendered until you choose to make them visible, so there is no "log lag."
- Scrobbles are locally queued to handle offline listening and failure resiliency (will retry scrobbles that fail)

### Planned UX Improvements

- Further accessibility where possible; testing for screen reader support and contrast checking.
- i18n by moving all strings out of code and allowing simple translation files.
- Honestly? Whatever other surprisingly good ideas the robot comes up with.

-- human non-generated text ends --

## Setup

- Open the plugin settings in Cider.
- Paste your ListenBrainz user token.
- Enable scrobbling.

Find your token in ListenBrainz under Account → Settings.

## Screenshots

- Settings: token input and scrobbling toggles.
- Advanced: status badges and MBIDs panel (dimmed when enrichment is off).
- Optional: debug logs visible on demand.

Place PNGs in the `screenshots/` folder with names like:
- `screenshots/settings.png`
- `screenshots/advanced-status.png`
- `screenshots/advanced-mbids.png`

Redact your ListenBrainz token before sharing.

## Development

Quick start:

```
pnpm build && pnpm deploy-dev
```

### Available Commands

- `pnpm dev` - Start dev server; enable Vite in Cider to load it (untested).
- `pnpm build` - Build to `dist/de.airsi.listenbrainz-plus`.
- `pnpm prepare-marketplace` - Create a ZIP for the Cider Marketplace.

### Install After Build

- Copy `dist/de.airsi.listenbrainz-plus` to the `/plugins` directory of your Cider app data directory.
  - On Windows, this is `%APPDATA%\C2Windows\plugins`
  - On macOS, this is `~/Library/Application Support/sh.cider.electron/plugins`
  - On Linux, this is `~/.config/sh.cider.electron/plugins` or `~/.config/sh.cider.genten`

### Prepare a ZIP for the Cider Marketplace

Run:

```
pnpm prepare-marketplace
```

This creates a ZIP in the `publish` directory ready to upload to the Cider Marketplace.

To configure this plugin, edit `src/plugin.config.ts`.

## Notes

- Scrobbling runs via a lightweight 2-second polling loop.
- Errors from ListenBrainz are logged; playback continues unaffected.
