import { toolDoctor } from "./doctor.mjs";
import { toolDeviceList, toolSimulatorBoot, toolSimulatorList } from "./devices.mjs";
import {
  toolWdaCacheStatus,
  toolWdaPrepare,
  toolWdaStartSimulator,
  toolWdaStatus,
  toolWdaStop,
} from "./wda.mjs";
import {
  toolAlertAccept,
  toolAlertButtons,
  toolAlertDismiss,
  toolAlertInput,
  toolAlertText,
  toolDeviceBattery,
  toolDeviceInfo,
  toolDeviceLock,
  toolDeviceLocked,
  toolDevicePress,
  toolDeviceUnlock,
  toolDoubleTap,
  toolDrag,
  toolHome,
  toolInput,
  toolKeyboardDismiss,
  toolLaunchApp,
  toolLongPress,
  toolPinch,
  toolRotate,
  toolScreenshot,
  toolSource,
  toolSwipe,
  toolTap,
  toolTerminateApp,
  toolTwoFingerTap,
} from "./actions.mjs";

export const tools = {
  ivista_doctor: {
    description: "Check local Xcode, simctl, git, iVista cache, and WDA configuration.",
    inputSchema: {
      type: "object",
      properties: {
        timeoutMs: { type: "number" },
        repo: { type: "string" },
        ref: { type: "string" },
      },
    },
    handler: toolDoctor,
  },
  ivista_simulator_list: {
    description: "List available iOS Simulators using simctl.",
    inputSchema: {
      type: "object",
      properties: {
        timeoutMs: { type: "number" },
        all: { type: "boolean" },
        booted: { type: "boolean" },
        iphone: { type: "boolean" },
        ipad: { type: "boolean" },
      },
    },
    handler: toolSimulatorList,
  },
  ivista_simulator_boot: {
    description: "Boot an iOS Simulator by name or UDID.",
    inputSchema: {
      type: "object",
      properties: {
        simulator: { type: "string" },
        name: { type: "string" },
        udid: { type: "string" },
        timeoutMs: { type: "number" },
      },
    },
    handler: toolSimulatorBoot,
  },
  ivista_device_list: {
    description: "List connected physical iOS devices using xcrun devicectl.",
    inputSchema: {
      type: "object",
      properties: {
        timeoutMs: { type: "number" },
        connected: { type: "boolean" },
      },
    },
    handler: toolDeviceList,
  },
  ivista_wda_cache_status: {
    description: "Inspect the local cached WebDriverAgent project.",
    inputSchema: {
      type: "object",
      properties: {
        repo: { type: "string" },
        ref: { type: "string" },
        wdaPath: { type: "string" },
      },
    },
    handler: toolWdaCacheStatus,
  },
  ivista_wda_prepare: {
    description: "Download and cache the pinned WebDriverAgent project if missing.",
    inputSchema: {
      type: "object",
      properties: {
        repo: { type: "string" },
        ref: { type: "string" },
        wdaPath: { type: "string" },
        timeoutMs: { type: "number" },
      },
    },
    handler: toolWdaPrepare,
  },
  ivista_wda_start_simulator: {
    description: "Start WebDriverAgent for a Simulator or physical iOS device, and wait for /status.",
    inputSchema: {
      type: "object",
      properties: {
        simulator: { type: "string" },
        device: { type: "string" },
        realDevice: { type: "boolean" },
        name: { type: "string" },
        udid: { type: "string" },
        repo: { type: "string" },
        ref: { type: "string" },
        wdaPath: { type: "string" },
        iosProject: { type: "string" },
        iosWorkspace: { type: "string" },
        workspace: { type: "string" },
        project: { type: "string" },
        scheme: { type: "string" },
        configuration: { type: "string" },
        signingTeam: { type: "string" },
        hostBundleId: { type: "string" },
        wdaBundleId: { type: "string" },
        port: { type: "number" },
        devicePort: { type: "number" },
        autoPort: { type: "boolean" },
        allowProvisioningUpdates: { type: "boolean" },
        waitMs: { type: "number" },
        timeoutMs: { type: "number" },
      },
    },
    handler: toolWdaStartSimulator,
  },
  ivista_wda_stop: {
    description: "Stop WebDriverAgent for a Simulator or device and clean the saved session.",
    inputSchema: {
      type: "object",
      properties: {
        simulator: { type: "string" },
        device: { type: "string" },
        udid: { type: "string" },
        name: { type: "string" },
        port: { type: "number" },
        timeoutMs: { type: "number" },
      },
    },
    handler: toolWdaStop,
  },
  ivista_wda_status: {
    description: "Read WDA /status from the configured base URL.",
    inputSchema: {
      type: "object",
      properties: {
        baseUrl: { type: "string" },
        port: { type: "number" },
        timeoutMs: { type: "number" },
      },
    },
    handler: toolWdaStatus,
  },
  ivista_screenshot: {
    description: "Take a WDA screenshot. Returns the WDA JSON response, usually with base64 image data.",
    inputSchema: { type: "object", properties: { baseUrl: { type: "string" }, port: { type: "number" }, output: { type: "string" } } },
    handler: toolScreenshot,
  },
  ivista_source: {
    description: "Read the current WDA source/accessibility tree.",
    inputSchema: { type: "object", properties: { baseUrl: { type: "string" }, port: { type: "number" } } },
    handler: toolSource,
  },
  ivista_tap: {
    description: "Tap screen coordinates through WDA.",
    inputSchema: {
      type: "object",
      required: ["x", "y"],
      properties: {
        x: { type: "number" },
        y: { type: "number" },
        baseUrl: { type: "string" },
        port: { type: "number" },
      },
    },
    handler: toolTap,
  },
  ivista_input: {
    description: "Type text through WDA.",
    inputSchema: {
      type: "object",
      required: ["text"],
      properties: {
        text: { type: "string" },
        baseUrl: { type: "string" },
        port: { type: "number" },
      },
    },
    handler: toolInput,
  },
  ivista_swipe: {
    description: "Swipe through WDA using a direction or explicit coordinates.",
    inputSchema: {
      type: "object",
      properties: {
        direction: { type: "string", enum: ["up", "down", "left", "right"] },
        width: { type: "number" },
        height: { type: "number" },
        fromX: { type: "number" },
        fromY: { type: "number" },
        toX: { type: "number" },
        toY: { type: "number" },
        duration: { type: "number" },
        baseUrl: { type: "string" },
        port: { type: "number" },
      },
    },
    handler: toolSwipe,
  },
  ivista_double_tap: {
    description: "Double tap screen coordinates through WDA.",
    inputSchema: {
      type: "object",
      required: ["x", "y"],
      properties: {
        x: { type: "number" },
        y: { type: "number" },
        baseUrl: { type: "string" },
        port: { type: "number" },
      },
    },
    handler: toolDoubleTap,
  },
  ivista_two_finger_tap: {
    description: "Perform a two-finger tap on the active app through WDA.",
    inputSchema: { type: "object", properties: { baseUrl: { type: "string" }, port: { type: "number" } } },
    handler: toolTwoFingerTap,
  },
  ivista_long_press: {
    description: "Long press screen coordinates through WDA.",
    inputSchema: {
      type: "object",
      required: ["x", "y"],
      properties: {
        x: { type: "number" },
        y: { type: "number" },
        duration: { type: "number" },
        baseUrl: { type: "string" },
        port: { type: "number" },
      },
    },
    handler: toolLongPress,
  },
  ivista_drag: {
    description: "Drag from one screen coordinate to another through WDA.",
    inputSchema: {
      type: "object",
      required: ["fromX", "fromY", "toX", "toY"],
      properties: {
        fromX: { type: "number" },
        fromY: { type: "number" },
        toX: { type: "number" },
        toY: { type: "number" },
        duration: { type: "number" },
        baseUrl: { type: "string" },
        port: { type: "number" },
      },
    },
    handler: toolDrag,
  },
  ivista_pinch: {
    description: "Pinch or zoom on the active app through WDA.",
    inputSchema: {
      type: "object",
      required: ["scale", "velocity"],
      properties: {
        scale: { type: "number" },
        velocity: { type: "number" },
        baseUrl: { type: "string" },
        port: { type: "number" },
      },
    },
    handler: toolPinch,
  },
  ivista_rotate: {
    description: "Rotate gesture on the active app through WDA.",
    inputSchema: {
      type: "object",
      required: ["rotation", "velocity"],
      properties: {
        rotation: { type: "number" },
        velocity: { type: "number" },
        baseUrl: { type: "string" },
        port: { type: "number" },
      },
    },
    handler: toolRotate,
  },
  ivista_home: {
    description: "Press the iOS Home button through WDA.",
    inputSchema: {
      type: "object",
      properties: {
        baseUrl: { type: "string" },
        port: { type: "number" },
      },
    },
    handler: toolHome,
  },
  ivista_keyboard_dismiss: {
    description: "Dismiss the iOS keyboard through WDA.",
    inputSchema: {
      type: "object",
      properties: {
        keyNames: { type: "string" },
        baseUrl: { type: "string" },
        port: { type: "number" },
      },
    },
    handler: toolKeyboardDismiss,
  },
  ivista_alert_accept: {
    description: "Accept the current iOS alert through WDA.",
    inputSchema: { type: "object", properties: { name: { type: "string" }, baseUrl: { type: "string" }, port: { type: "number" } } },
    handler: toolAlertAccept,
  },
  ivista_alert_dismiss: {
    description: "Dismiss the current iOS alert through WDA.",
    inputSchema: { type: "object", properties: { name: { type: "string" }, baseUrl: { type: "string" }, port: { type: "number" } } },
    handler: toolAlertDismiss,
  },
  ivista_alert_text: {
    description: "Read text from the current iOS alert through WDA.",
    inputSchema: { type: "object", properties: { baseUrl: { type: "string" }, port: { type: "number" } } },
    handler: toolAlertText,
  },
  ivista_alert_input: {
    description: "Type text into the current iOS alert through WDA.",
    inputSchema: { type: "object", required: ["text"], properties: { text: { type: "string" }, baseUrl: { type: "string" }, port: { type: "number" } } },
    handler: toolAlertInput,
  },
  ivista_alert_buttons: {
    description: "Read button labels from the current iOS alert through WDA.",
    inputSchema: { type: "object", properties: { baseUrl: { type: "string" }, port: { type: "number" } } },
    handler: toolAlertButtons,
  },
  ivista_device_lock: {
    description: "Lock the iOS device through WDA.",
    inputSchema: { type: "object", properties: { baseUrl: { type: "string" }, port: { type: "number" } } },
    handler: toolDeviceLock,
  },
  ivista_device_unlock: {
    description: "Unlock the iOS device through WDA.",
    inputSchema: { type: "object", properties: { baseUrl: { type: "string" }, port: { type: "number" } } },
    handler: toolDeviceUnlock,
  },
  ivista_device_locked: {
    description: "Check whether the iOS device is locked through WDA.",
    inputSchema: { type: "object", properties: { baseUrl: { type: "string" }, port: { type: "number" } } },
    handler: toolDeviceLocked,
  },
  ivista_device_info: {
    description: "Read device information through WDA.",
    inputSchema: { type: "object", properties: { baseUrl: { type: "string" }, port: { type: "number" } } },
    handler: toolDeviceInfo,
  },
  ivista_device_battery: {
    description: "Read battery information through WDA.",
    inputSchema: { type: "object", properties: { baseUrl: { type: "string" }, port: { type: "number" } } },
    handler: toolDeviceBattery,
  },
  ivista_device_press: {
    description: "Press a supported hardware button through WDA, such as volumeUp or volumeDown.",
    inputSchema: { type: "object", required: ["name"], properties: { name: { type: "string" }, duration: { type: "number" }, baseUrl: { type: "string" }, port: { type: "number" } } },
    handler: toolDevicePress,
  },
  ivista_launch_app: {
    description: "Launch an app by bundle id through WDA.",
    inputSchema: {
      type: "object",
      required: ["bundleId"],
      properties: {
        bundleId: { type: "string" },
        arguments: { type: "array", items: { type: "string" } },
        environment: { type: "object" },
        baseUrl: { type: "string" },
        port: { type: "number" },
      },
    },
    handler: toolLaunchApp,
  },
  ivista_terminate_app: {
    description: "Terminate an app by bundle id through WDA.",
    inputSchema: {
      type: "object",
      required: ["bundleId"],
      properties: {
        bundleId: { type: "string" },
        baseUrl: { type: "string" },
        port: { type: "number" },
      },
    },
    handler: toolTerminateApp,
  },
};

export function listTools() {
  return Object.entries(tools).map(([name, tool]) => ({
    name,
    description: tool.description,
    inputSchema: tool.inputSchema,
  }));
}

export async function callTool(name, args = {}) {
  const tool = tools[name];
  if (!tool) throw new Error(`Unknown tool: ${name}`);
  return await tool.handler(args);
}
