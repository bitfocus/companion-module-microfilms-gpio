## Microfilms GPIO

⚠️ This module (1.1.0) requires Companion 5.x. For Companion 4.x, use a 0.x version of the module.

Controls the 32 GPIO bits of a Microfilms robot (stage machinery) from Companion and a Stream Deck, over UDP.

### Configuration

- **Target IP**: robot address, `192.168.10.10` by default. For the local simulator: `127.0.0.1`.
- **Target Port**: UDP port, `7770` by default.

The connection turns **OK** as soon as a `Status` response arrives. A ping is sent every 500 ms; with no response for 3 s, the status turns **Disconnected**. Saving the configuration reconnects to the new address and port.

### Actions (one bit = one action)

- **GPIO 01 pulse (100 ms) … GPIO 32 pulse (100 ms)**: sets the bit on, then off after 100 ms.
- **GPIO 01 set on … GPIO 32 set on**: sets the bit on and keeps it on.
- **GPIO 01 set off … GPIO 32 set off**: sets the bit off.

The other bits are left unchanged.

### Presets (GPIO section)

- **IMP n**: on press, runs the pulse action (flash).
- **TS n** (Two states): press = set on, release = set off (green while the key is held).

### Feedbacks

**Gpio01 … Gpio32**: button background color from the last state reported by the robot / simulator.

- Presets: black = off, green = on.
- Plain feedback: red = off, green = on (adjustable colors).

### Variables

| Variable                        | Value                                                                              |
| ------------------------------- | ---------------------------------------------------------------------------------- |
| `$(MFGpio:01)` … `$(MFGpio:32)` | State of GPIO 1 … 32: `0` (off) or `1` (on)                                        |
| `$(MFGpio:Full)`                | The 32 bits as an unsigned integer, Little Endian (bit 1 = 1, bit 32 = 2147483648) |

Replace `MFGpio` with the label of your connection. Variables are updated when a `Status` response reports a new state.

### Testing without a robot (simulator)

In the module folder, with Node 26:

```bash
node tools/udp-server.js
```

Point the connection to `127.0.0.1:7770`. Messages scroll in the terminal (pings). Place a **TS 1** preset and hold the key: green button; release: black button. Stop the simulator: the connection turns **Disconnected**.
