"""Writes database.rules.json. Edit the rules here: the helpers keep the long expressions consistent.

Run: python3 scripts/build-rules.py
"""
import json
from pathlib import Path

S = "root.child('sessions/' + $code + '"
LIVE = f"{S}/meta/expiresAt').val() > now"
HOST = f"{S}/meta/facilitator').val() === auth.uid"
CAN_VIEW = f"{S}/meta/canView').val() === true"
# Someone who returned on a new device acts as their original participant id (pid).
ALIAS = f"{S}/aliases/' + auth.uid + '/pid').val()"
ME = f"(auth.uid === $uid || {ALIAS} === $uid)"
MEMBER = f"({S}/members/' + auth.uid).exists() || {S}/aliases/' + auth.uid).exists())"
SIGNED_IN = "auth != null"
CODE8 = "/^[A-HJKMNP-Z2-9]{8}$/"
NEW_ROOT = "newData.parent().parent()"

def all_of(*parts):
    return " && ".join(parts)

rules = {
  "rules": {
    "sessions": {
      ".indexOn": ["meta/expiresAt"],
      "$code": {
        ".validate": "$code.matches(/^[A-HJKMNP-Z2-9]{6}$/)",
        ".write": "auth != null && !newData.exists() && (data.child('meta/facilitator').val() === auth.uid || data.child('meta/expiresAt').val() < now)",

        "meta": {
          ".read": "auth != null && data.child('expiresAt').val() > now",
          ".write": "auth != null && newData.exists() && ((!data.exists() && newData.child('facilitator').val() === auth.uid) || (data.child('facilitator').val() === auth.uid && data.child('expiresAt').val() > now))",
          ".validate": "newData.hasChildren(['title', 'facilitator', 'createdAt', 'expiresAt', 'canView'])",
          "title": {".validate": "newData.isString() && newData.val().length >= 1 && newData.val().length <= 80"},
          "facilitator": {".validate": "!data.exists() || newData.val() === data.val()"},
          "createdAt": {".validate": "data.exists() ? newData.val() === data.val() : newData.val() === now"},
          "expiresAt": {".validate": "newData.isNumber() && (data.exists() ? newData.val() === data.val() : (newData.val() > now && newData.val() <= now + 2592000000))"},
          "canView": {".validate": "newData.isBoolean()"},
          "step": {".validate": "newData.isNumber() && newData.val() >= 0 && newData.val() <= 3 && newData.val() % 1 === 0"},
          "spotlight": {
            ".validate": "newData.hasChildren(['uid', 'name'])",
            "uid": {".validate": "newData.isString() && newData.val().length <= 128"},
            "name": {".validate": "newData.isString() && newData.val().length <= 60"},
            "$other": {".validate": False},
          },
          "$other": {".validate": False},
        },

        "members": {
          ".read": all_of(SIGNED_IN, LIVE, f"({HOST} || ({MEMBER} && {CAN_VIEW}))"),
          "$uid": {
            ".read": all_of(SIGNED_IN, ME),
            ".write": all_of(SIGNED_IN, "auth.uid === $uid", "newData.exists()", LIVE, f"!({HOST})"),
            ".validate": "newData.hasChildren(['name', 'joinedAt'])",
            "name": {".validate": "newData.isString() && newData.val().length >= 1 && newData.val().length <= 60"},
            "joinedAt": {".validate": "newData.isNumber() && newData.val() <= now"},
            "$other": {".validate": False},
          },
        },

        "canvases": {
          ".read": all_of(SIGNED_IN, LIVE, f"({HOST} || ({MEMBER} && {CAN_VIEW}))"),
          "$uid": {
            ".read": all_of(SIGNED_IN, LIVE, f"({ME} || ({MEMBER} && {S}/meta/spotlight/uid').val() === $uid))"),
            ".write": all_of(SIGNED_IN, ME, "newData.exists()", LIVE, f"{S}/members/' + $uid).exists()"),
            ".validate": "newData.hasChildren(['state', 'updatedAt'])",
            "state": {".validate": "newData.isString() && newData.val().length <= 300000"},
            "updatedAt": {".validate": "newData.val() === now"},
            "$other": {".validate": False},
          },
        },

        "comments": {
          ".read": all_of(SIGNED_IN, LIVE, HOST),
          "$uid": {
            ".read": all_of(SIGNED_IN, ME, LIVE),
            "$cid": {
              ".write": all_of(SIGNED_IN, HOST, LIVE),
              ".validate": "newData.hasChildren(['text', 'createdAt'])",
              "text": {".validate": "newData.isString() && newData.val().length >= 1 && newData.val().length <= 1000"},
              "cellId": {".validate": "newData.isString() && newData.val().length <= 40"},
              "createdAt": {".validate": "data.exists() ? newData.val() === data.val() : newData.val() === now"},
              "$other": {".validate": False},
            },
          },
        },

        # Rejoin codes: rejoin/<code> points to the participant's original id. Readable one code at a
        # time (never listed), so only someone holding the code can find their canvas.
        "rejoin": {
          "$key": {
            ".read": all_of(SIGNED_IN, LIVE),
            ".write": all_of(
              SIGNED_IN, "!data.exists()", "newData.val() === auth.uid", LIVE,
              f"{NEW_ROOT}.child('rejoinKeys/' + auth.uid).val() === $key",
              f"{NEW_ROOT}.child('members/' + auth.uid).exists()",
            ),
            ".validate": f"$key.matches({CODE8}) && newData.isString()",
          },
        },
        # Each participant's own code, for them and the host.
        "rejoinKeys": {
          ".read": all_of(SIGNED_IN, LIVE, HOST),
          "$uid": {
            ".read": all_of(SIGNED_IN, LIVE, ME),
            ".write": all_of(
              SIGNED_IN, "auth.uid === $uid", "!data.exists()", LIVE,
              f"{NEW_ROOT}.child('rejoin/' + newData.val()).val() === auth.uid",
            ),
            ".validate": f"newData.isString() && newData.val().matches({CODE8})",
          },
        },
        # A new device that entered a valid rejoin code.
        "aliases": {
          "$uid": {
            ".read": all_of(SIGNED_IN, "auth.uid === $uid"),
            ".write": all_of(SIGNED_IN, "auth.uid === $uid", "newData.exists()", LIVE, f"!({HOST})"),
            ".validate": f"newData.hasChildren(['pid', 'key']) && newData.child('key').val().matches({CODE8}) && {S}/rejoin/' + newData.child('key').val()).val() === newData.child('pid').val()",
            "pid": {".validate": "newData.isString()"},
            "key": {".validate": "newData.isString()"},
            "$other": {".validate": False},
          },
        },

        "$other": {".validate": False},
      },
    },

    "expiries": {
      ".read": False,
      ".indexOn": ".value",
      "$code": {
        ".write": "auth != null && (newData.exists() ? (!data.exists() && newData.parent().parent().child('sessions/' + $code + '/meta/facilitator').val() === auth.uid && newData.val() === newData.parent().parent().child('sessions/' + $code + '/meta/expiresAt').val()) : (data.val() < now || root.child('sessions/' + $code + '/meta/facilitator').val() === auth.uid))",
        ".validate": "newData.isNumber()",
      },
    },
  }
}

out = Path(__file__).resolve().parent.parent / "database.rules.json"
out.write_text(json.dumps(rules, indent=2) + "\n")
print(f"Wrote {out.name}")
