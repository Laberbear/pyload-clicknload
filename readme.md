pyload-clicknload
-----------------

This script emulates the JDownloader2 Click'N'Load functionality to be used without it.
It creates a Webserver on http://127.0.0.1:9666 and listens for Click'N'Load calls.

Already built bundled can be found in the GitHub releases top right
https://github.com/Laberbear/pyload-clicknload/releases

The received links are shown in the Terminal to either be copied and used manually or they can be automatically sent to your Pyload instance.

For that create a ```pyloadConfig.json```  in the app's folder containing
```json
{
    "pyloadUser": "USER",
    "pyloadPW": "ABC",
    "pyloadUrl": "https://my-pyload-instance.example"
}
```
##### NOTE: You're storing credentials in plaintext here. Use at your own discretion