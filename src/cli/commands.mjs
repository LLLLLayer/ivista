export const commandMap = new Map([
  ["doctor", "ivista_doctor"],
  ["run start", "ivista_run_start"],
  ["run current", "ivista_run_current"],
  ["simulator list", "ivista_simulator_list"],
  ["simulator boot", "ivista_simulator_boot"],
  ["device list", "ivista_device_list"],
  ["wda cache status", "ivista_wda_cache_status"],
  ["wda prepare", "ivista_wda_prepare"],
  ["wda start", "ivista_wda_start_simulator"],
  ["wda stop", "ivista_wda_stop"],
  ["wda status", "ivista_wda_status"],
  ["screen shot", "ivista_screenshot"],
  ["screen source", "ivista_source"],
  ["screen texts", "ivista_screen_texts"],
  ["wait text", "ivista_wait_text"],
  ["act home", "ivista_home"],
  ["act tap", "ivista_tap"],
  ["act double-tap", "ivista_double_tap"],
  ["act two-finger-tap", "ivista_two_finger_tap"],
  ["act long-press", "ivista_long_press"],
  ["act drag", "ivista_drag"],
  ["act pinch", "ivista_pinch"],
  ["act rotate", "ivista_rotate"],
  ["act input", "ivista_input"],
  ["act swipe", "ivista_swipe"],
  ["keyboard dismiss", "ivista_keyboard_dismiss"],
  ["alert accept", "ivista_alert_accept"],
  ["alert dismiss", "ivista_alert_dismiss"],
  ["alert text", "ivista_alert_text"],
  ["alert input", "ivista_alert_input"],
  ["alert buttons", "ivista_alert_buttons"],
  ["device lock", "ivista_device_lock"],
  ["device unlock", "ivista_device_unlock"],
  ["device locked", "ivista_device_locked"],
  ["device info", "ivista_device_info"],
  ["device battery", "ivista_device_battery"],
  ["device press", "ivista_device_press"],
  ["app launch", "ivista_launch_app"],
  ["app terminate", "ivista_terminate_app"],
]);

export function resolveCommand(positionals) {
  const candidates = [
    positionals.slice(0, 3).join(" "),
    positionals.slice(0, 2).join(" "),
    positionals.slice(0, 1).join(" "),
  ].filter(Boolean);
  for (const candidate of candidates) {
    if (commandMap.has(candidate)) return { key: candidate, tool: commandMap.get(candidate) };
  }
  return null;
}
