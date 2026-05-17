import { CLI_VERSION } from "./constants.mjs";

export function printHelp() {
  console.log(`iVista CLI ${CLI_VERSION}

Usage:
  ivista version
  ivista update [--ref main]
  ivista doctor [--json]
  ivista simulator list [--all] [--booted] [--iphone|--ipad] [--json]
  ivista simulator boot
  ivista simulator boot 1
  ivista simulator boot --name "iPhone 16"
  ivista device list [--connected] [--json]
  ivista wda prepare [--ref ivista-wda-v0.1.1]
  ivista wda start [--port 8100]
  ivista wda start --simulator "iPhone 16" [--port 8100]
  ivista wda start --simulator "iPhone 16" --auto-port
  ivista wda start --device <device-udid> --ios-project MyApp.xcodeproj --scheme MyApp
  ivista wda stop [--port 8100]
  ivista wda status [--port 8100]
  ivista screen shot [--port 8100] [--output /tmp/ivista.png]
  ivista screen source [--port 8100]
  ivista screen texts [--port 8100]
  ivista wait text "Wi-Fi" [--port 8100] [--timeout 10000]
  ivista act home [--port 8100]
  ivista act tap --x 120 --y 500
  ivista act tap --text "Wi-Fi"
  ivista act tap --contains "语言" [--index 1]
  ivista act double-tap --x 120 --y 500
  ivista act double-tap --text "照片"
  ivista act two-finger-tap
  ivista act long-press --x 120 --y 500 [--duration 1]
  ivista act long-press --text "App" [--duration 1]
  ivista act drag --from-x 100 --from-y 600 --to-x 300 --to-y 200 [--duration 0.5]
  ivista act pinch --scale 0.5 --velocity -1
  ivista act rotate --rotation 1.57 --velocity 1
  ivista act input "hello"
  ivista act swipe --direction up
  ivista keyboard dismiss
  ivista alert accept [--name OK]
  ivista alert dismiss [--name Cancel]
  ivista alert text
  ivista alert input "hello"
  ivista alert buttons
  ivista device lock
  ivista device unlock
  ivista device locked
  ivista device info
  ivista device battery
  ivista device press --name volumeUp
  ivista app launch --bundle-id com.example.app
  ivista app terminate --bundle-id com.example.app

Options:
  --json                  Print raw JSON output.
  --all                   Show all Simulator runtimes instead of a compact deduped list.
  --booted                Show only running Simulators.
  --iphone                Show only iPhone Simulators.
  --ipad                  Show only iPad Simulators.
  --auto-port             Find an available WDA port automatically.
  --connected             Show only connected physical iOS devices.
  --simulator <name|udid> Simulator name or UDID.
  --device <name|udid>    Physical iOS device name or UDID.
  --name <name>           Simulator name.
  --udid <udid>           Device or Simulator UDID.
  --bundle-id <id>        App bundle id.
  --base-url <url>        WDA base URL.
  --port <port>           WDA port. Defaults to 8100.
  --output <path>         Output path for commands that save files.
  --text <text>           Match an accessibility name, label, or value exactly.
  --contains <text>       Match accessibility text partially.
  --regex <pattern>       Match accessibility text with a regular expression.
  --index <n>             Use the nth matched accessibility element. Defaults to 1.
  --duration <seconds>    Gesture duration in seconds.
  --scale <number>        Pinch scale. Values under 1 zoom out; over 1 zoom in.
  --velocity <number>     Gesture velocity.
  --rotation <radians>    Rotation gesture amount in radians.
  --key-names <names>     Comma-separated keyboard dismissal key names.
  --wda-path <path>       Use an explicit WDA project path.
  --ios-project <path>    Host iOS .xcodeproj used to infer signing.
  --workspace <path>      Host iOS .xcworkspace used to infer signing.
  --scheme <name>         Host iOS scheme used to infer signing.
  --configuration <name>  Host iOS build configuration. Defaults to Debug.
  --signing-team <id>     Apple development team id for WDA signing.
  --wda-bundle-id <id>    Bundle id to use for WDA on a real device.
  --network               Force network mode for a real device.
  --usb                   Force USB iproxy for a real device.
  --repo <url>            WDA git repository.
  --ref <ref>             WDA git ref. Defaults to ivista-wda-v0.1.1.
  --timeout <ms>          Command timeout in milliseconds.
  --wait <ms>             WDA startup wait timeout in milliseconds.
`);
}

export function printVersion(rawJson = false) {
  const payload = {
    name: "ivista",
    version: CLI_VERSION,
  };
  if (rawJson) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }
  console.log(`iVista CLI ${CLI_VERSION}`);
}
