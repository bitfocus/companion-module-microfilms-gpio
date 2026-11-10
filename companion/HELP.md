## Microfilms GPIO

This module requires Companion 5.0 or later.

Controls the 32 GPIOs of a Microfilms robot (stage machinery) from Companion and a Stream Deck, over UDP.

### Configuration

- **Target IP**: robot address, `192.168.10.10` by default. For the local simulator: `127.0.0.1`.
- **Target Port**: UDP port, `7770` by default.

The connection turns **OK** as soon as a `Status` response arrives. A ping is sent every 500 ms; with no response for 3 s, the status turns **Disconnected**. The status turns **Connection failure** with the reason when a ping cannot be sent (network unreachable, for example), when the `Status` response is invalid (wrong header or length), or on a UDP socket error. Saving the configuration reconnects to the new address and port.

### Actions

Each action has a **GPIO** option, from 1 to 32. The other GPIOs are left unchanged.

- **GPIO pulse**: sets the GPIO on, then off after 100 ms.
- **GPIO set on**: sets the GPIO on and keeps it on.
- **GPIO set off**: sets the GPIO off.

### Presets (GPIO section)

- **IMP n**: on press, runs a pulse on GPIO n (flash).
- **TS n** (Two states): press = set on, release = set off (green while the key is held).

Both use a black background, green while the GPIO is on.

### Feedback

**GPIO state** (boolean, **GPIO** option from 1 to 32): true while the GPIO is on, from the last state reported by the robot / simulator. The default style is a green background; tick **Inverted** to style the off state instead.

### Variables

| Variable                        | Value                                                                            |
| ------------------------------- | -------------------------------------------------------------------------------- |
| `$(MFGpio:01)` … `$(MFGpio:32)` | State of GPIO 1 … 32: `0` (off) or `1` (on)                                      |
| `$(MFGpio:Full)`                | All GPIO states as an unsigned 32-bit integer (GPIO 1 = 1, GPIO 32 = 2147483648) |

Replace `MFGpio` with the label of your connection. Variables are updated when a `Status` response reports a new state.

### Upgrading from 1.1.0 or earlier

Up to 1.1.0, each GPIO had its own actions (`GPIO 05 pulse (100 ms)`, `GPIO 05 set on`, `GPIO 05 set off`) and its own feedback (`GPIO 05 state`). On the first start of 1.2.0, Companion converts the existing buttons to the new actions and feedback, with the same GPIO. The feedback keeps its "on" color; the "off" color option no longer exists (the button shows its own background instead).

### Testing without a robot (simulator)

In the module folder, with Node 26:

```bash
node tools/udp-server.js
```

Point the connection to `127.0.0.1:7770`. Messages scroll in the terminal (pings). Place a **TS 1** preset and hold the key: green button; release: black button. Stop the simulator: the connection turns **Disconnected**.
