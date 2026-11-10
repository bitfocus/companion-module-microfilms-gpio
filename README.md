# Companion Module - Microfilms GPIO

## Description

This Companion module controls Microfilms robots (stage machinery) over UDP, by setting the GPIOs of the robot on or off. The GPIOs follow the actions of the user in Companion (for example the "Impulse" or "Two states" presets), and the robot reports the current state of its GPIOs in "Status" responses.

The module handles 32 GPIOs (4 bytes). It sends commands to the robot to set the GPIOs and receives the status responses.

## Features

- **Actions** (each with a **GPIO** option, 1 to 32):
  - `GPIO pulse`: sets the GPIO on, then off after 100 ms.
  - `GPIO set on` / `GPIO set off`: sets the GPIO on or off. The "Two states" presets set it on while the key is pressed and off when it is released.
- **Feedback** `GPIO state` (boolean, **GPIO** option): green background while the GPIO is on, from the last status response. Companion's **Inverted** option styles the off state instead.
- **Variables**: `01` … `32` (state 0/1 of each GPIO) and `Full` (all GPIO states as an unsigned 32-bit integer, Little Endian), updated on every state change.
- **Connection status**: **OK** on every valid response, **Disconnected** after 3 s without a response, **Connection failure** with the reason when a ping cannot be sent or the response is invalid. Each new reason is logged once.
- **UDP communication**: the module sends "Set GPIO" messages and the robot answers with "Status" messages.

## Requirements

- Companion **5.0** or later (the module uses `@companion-module/base` 2.x and no longer loads on Companion 4).
- Node **26** for development, tests and packaging (`.node-version` = `26`, for example with `fnm use --install-if-missing`).
- Yarn **4** through corepack (`packageManager` field of `package.json`). If corepack is missing from the installed Node 26: `npm i -g corepack`, then `corepack enable`.
- IP address and port of the Microfilms robot (set in the configuration of the Companion connection).
- UDP simulator of the robot (included, to test without hardware).

## Configuration

1. Enter the IP address and port of the Microfilms robot in the connection configuration.
2. Set up the actions and the feedback in Companion, or use the presets of the "GPIO" section.
3. Use the included UDP simulator to test the communication.

## Upgrading from 1.1.0 or earlier

Version 1.2.0 replaces the 96 per-GPIO actions (`impulseN`, `upN`, `downN`) and the 32 per-GPIO advanced feedbacks (`gpio_state_bit_N`) by 3 actions (`pulse`, `set_on`, `set_off`) and 1 boolean feedback (`gpio_state`), each with a `gpio` option. An upgrade script converts the saved buttons on the first start: the GPIO number goes to the `gpio` option and the feedback keeps its `colorOn` color as its style. The `colorOff` color is dropped.

## Command structure

### `Set GPIO` command

The module sends the `Set GPIO` command to set the GPIOs. It holds:

- **Header**: `INP` (3 bytes), identifies the command.
- **GPIO bytes**: 4 bytes, the state of the 32 GPIOs.
- **Mask bytes**: 4 bytes, the GPIOs to change.
- **Reserved**: 2 bytes at 0.

### `Status` response

The robot answers with a `Status` message:

- **Header**: `OUT` (3 bytes).
- **GPIO bytes**: 4 bytes, the current state of the 32 GPIOs.

### UDP message example

#### `Set GPIO` (set GPIO 1 on)

```bash
INP 00000000 00000000 00000000 00000001 00000000 00000000 00000000 00000001
```

- Header: `INP`
- GPIO bytes: `[00000000 00000000 00000000 00000001]` (GPIO 1 on)
- Mask bytes: `[00000000 00000000 00000000 00000001]` (only GPIO 1 is changed, the others are left as they are)

#### `Status` response

```bash
OUT 00000000 00000000 00000000 00000001
```

- Header: `OUT`
- GPIO bytes: `[00000000 00000000 00000000 00000001]` (GPIO 1 on)

## How the module works

1. **UDP setup**: the module opens a UDP socket to the robot (or the simulator) on start and pings it every 500 ms.
2. **Actions**: when the user runs an action (pulse, set on, set off), the module sends a "Set GPIO" UDP command for the GPIO of the action.
3. **Status responses**: the robot answers with a "Status" message, and the module updates the feedback and the variables when the GPIO state changes.

## Robot UDP simulator

A robot simulator is included to test the Companion module without a physical robot. It listens on UDP port 7770 and answers each Set GPIO command with a Status response holding the updated GPIOs.

### Using the simulator

1. Start the robot UDP simulator (Node 26):

```bash
fnm use --install-if-missing
node tools/udp-server.js
```

2. Point the Companion connection to the IP address and port of the simulator.
3. Use Companion to send commands and watch the responses.

## Files

- **src/main.js**: entrypoint of the Companion module (manifest `../src/main.js`); handles the configuration, the NetworkManager, the connection status, the variables and the feedback.
- **src/network.js**: UDP connection and communication with the robot.
- **src/actions.js**: the `pulse`, `set_on` and `set_off` actions.
- **src/feedbacks.js**: the `gpio_state` boolean feedback.
- **src/options.js**: the `gpio` option shared by the actions and the feedback, and its validation.
- **src/presets.js**: button presets for the 32 GPIOs ("GPIO" section).
- **src/variables.js**: the `01` … `32` and `Full` variables.
- **src/protocol.js**: pure helpers of the UDP/GPIO protocol (`INP` / `OUT` frames, mask, GPIO 1–32).
- **src/upgrades.js**: configuration upgrade scripts (1.2.0: per-GPIO actions and feedbacks to the `gpio` option).
- **tools/udp-server.js**: robot simulator that receives the Set GPIO commands and sends statuses back (not bundled).
- **test/**: `node --test` tests of the protocol, the actions, the definitions, the upgrade script, the module and the NetworkManager (ephemeral ports).

## Installation (development)

Clone the repository into a subfolder of the Companion developer modules path (`--extra-module-path` option or _Developer modules path_ setting).
Install the dependencies with Node 26 and Yarn 4:

```bash
fnm use --install-if-missing
corepack enable
yarn install
```

Start Companion 5, add the "Microfilms: Gpio" connection (**Dev** version) and set the IP address and port of the robot.

## Tests

```bash
yarn test
yarn lint
yarn format
```

The tests freeze the UDP protocol (13 / 7 byte frames, mask, 100 ms pulse, 500 ms ping, 3 s timeout) and never open port 7770. `yarn format` runs Prettier (configuration of `@companion-module/tools`); ESLint only keeps quality rules. `yarn doc` regenerates the JSDoc in `docs/`.

## Packaging

### Building the bundle for Companion 5

```bash
yarn package
```

This command (`companion-module-build`) creates the `pkg/microfilms-gpio/` folder and the `microfilms-gpio-<version>.tgz` archive at the root of the project. This archive is the file to hand over.

### Installing the bundle (Companion 5)

1. Open the Companion web interface
2. Go to **Modules**
3. Click **Import offline module bundle**
4. Select the `microfilms-gpio-<version>.tgz` file
5. The module is installed right away
6. No restart needed

✅ **Benefits**: simple installation from the web interface, no access to system files needed.

⚠️ **Version**: during development, Companion shows the module as "Dev". Once installed from the offline bundle, it shows the version of `package.json`.

⚠️ **Compatibility**: since version 1.0.0, the module targets the `@companion-module/base` 2.x API and no longer loads on Companion 4.x or 3.x. Since version 1.1.0, it runs on the `node26` runtime.
