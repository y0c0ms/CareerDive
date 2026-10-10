# Xbox Controller Macro HUD

A comprehensive Python application for recording, editing, and playing macros for Xbox controllers. This tool provides a user-friendly HUD interface that allows you to capture controller inputs, save them as macros, and replay them with customizable timing.

## Features

- **Controller Detection**: Automatically detects and connects to Xbox controllers
- **Real-time Input Monitoring**: Live display of controller button presses, stick movements, and trigger inputs
- **Macro Recording**: Record complex controller sequences with precise timing
- **Macro Editing**: Save, load, and manage multiple macros
- **Macro Playback**: Play recorded macros with loop functionality
- **Actual Input Simulation**: Uses virtual gamepad to inject real controller inputs that emulators can recognize
- **File Management**: Save and load macro collections as JSON files
- **User-friendly GUI**: Intuitive interface with real-time feedback
- **Cross-platform Support**: Works on Windows, macOS, and Linux

## Requirements

- Python 3.7 or higher
- Xbox controller (wired or wireless)
- Windows, macOS, or Linux

## Installation

### Quick Install
1. Clone or download this repository
2. Run the dependency installer:
   ```bash
   python install_dependencies.py
   ```

### Manual Install
1. Clone or download this repository
2. Install the required dependencies:
   ```bash
   pip install -r requirements.txt
   ```

### Windows Users
If you encounter issues with `vgamepad`, you may need to install Visual C++ Redistributable:
- Download from: https://aka.ms/vs/17/release/vc_redist.x64.exe
- Install the redistributable, then retry the installation

### ViGEmBus Driver (Required for Virtual Gamepad)
The application requires the ViGEmBus driver for virtual gamepad functionality:

**Automatic Installation:**
```bash
python install_vigembus.py
```

**Manual Installation:**
1. Download from: https://github.com/ViGEm/ViGEmBus/releases/latest
2. Run the installer as Administrator
3. Restart your computer

**Alternative Input Method:**
If ViGEmBus installation fails, the application will automatically fall back to keyboard/mouse simulation.

## Usage

1. Connect your Xbox controller to your computer
2. Run the application:
   ```bash
   python xbox_macro_hud.py
   ```
3. The HUD will open and automatically detect your controller

### Recording Macros

1. Enter a name for your macro in the "Macro Name" field
2. Click "Start Recording" to begin capturing controller inputs
3. Perform the actions you want to record on your controller
4. Click "Stop Recording" when finished
5. Click "Save Macro" to store the recorded sequence

### Playing Macros

1. Select a macro from the "Saved Macros" list
2. Check "Loop" if you want the macro to repeat continuously
3. Click "Play Macro" to execute the recorded sequence
4. Click "Stop" to halt playback

### Managing Macros

- **Save All**: Export all macros to a JSON file
- **Load Macros**: Import macros from a JSON file
- **Delete Macro**: Remove a selected macro from the list

## Controller Input Types

The application captures and records:

- **Buttons**: A, B, X, Y, LB, RB, Back, Start, Left Stick, Right Stick
- **Analog Sticks**: Left and right stick movements with precise positioning
- **Triggers**: Left and right trigger pressure
- **D-Pad**: Directional pad inputs

## File Format

Macros are saved in JSON format with the following structure:

```json
{
  "macro_name": {
    "name": "macro_name",
    "data": [
      {
        "buttons": {"button_0": true, "button_1": false, ...},
        "axes": {"axis_0": 0.5, "axis_1": -0.3, ...},
        "hats": {"hat_0": (0, 1)},
        "timestamp": 1234567890.123,
        "relative_time": 0.0
      }
    ],
    "created": "2024-01-01T12:00:00",
    "modified": "2024-01-01T12:00:00"
  }
}
```

## Troubleshooting

### Controller Not Detected
- Ensure your Xbox controller is properly connected
- Try reconnecting the controller
- Check that pygame can detect the controller by running:
  ```python
  import pygame
  pygame.init()
  pygame.joystick.init()
  print(f"Controllers found: {pygame.joystick.get_count()}")
  ```

### Recording Issues
- Make sure the controller is connected before starting recording
- Ensure you're actually pressing buttons or moving sticks during recording
- Check that the macro name field is not empty when saving

### Playback Issues
- Note that actual input simulation is not implemented in this version
- The application currently logs what would be simulated
- For actual input injection, additional system-level libraries would be required

## Limitations

- **Input Simulation**: The current version does not actually simulate controller inputs during playback. It only logs what would be simulated.
- **Platform Compatibility**: While pygame works on multiple platforms, controller detection may vary.
- **Security**: Some systems may require administrator privileges for input simulation.

## Future Enhancements

- Actual input simulation during playback
- Macro timing adjustment tools
- Visual macro editor with timeline
- Support for multiple controller profiles
- Advanced macro conditions and triggers
- Integration with popular games

## Contributing

Feel free to submit issues, feature requests, or pull requests to improve this application.

## License

This project is open source and available under the MIT License.

## Disclaimer

This tool is for educational and personal use only. Please respect the terms of service of any games or applications you use this tool with. The authors are not responsible for any misuse of this software.
