import { useState } from "react";
import { GoogleLogin } from "@react-oauth/google";
import { useAuth } from "../context/AuthContext";
import "./MyPage.css";

function compressImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const max = 480;
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.82));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("이미지를 읽지 못했습니다."));
    };
    img.src = url;
  });
}

export default function MyPage() {
  const { user, isAuthed, localMode, loginWithGoogle, logout, updateNickname, updateAvatar } = useAuth();
  const [nick, setNick] = useState(user?.nickname || "");
  const [busy, setBusy] = useState("");
  const [note, setNote] = useState("");

  if (!isAuthed) {
    return (
      <main className="page mypage">
        <section className="mypage__card">
          <p className="mypage__kicker">ACCOUNT</p>
          <h1>마이페이지</h1>
          <p className="mypage__lead">Google 계정으로 들어오면 이름과 사진을 이 공간에만 둡니다.</p>
          <div className="mypage__login">
            <GoogleLogin
              onSuccess={async (cred) => {
                try {
                  await loginWithGoogle(cred.credential);
                } catch (e) {
                  setNote(e.message);
                }
              }}
              onError={() => setNote("Google 로그인을 완료하지 못했습니다.")}
              theme="filled_black"
              shape="pill"
              text="continue_with"
              width="280"
            />
          </div>
          {note && <p className="mypage__note">{note}</p>}
        </section>
      </main>
    );
  }

  const initial = (user.nickname || user.name || "?").slice(0, 1);

  const onPhoto = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy("photo");
    setNote("");
    try {
      const data = await compressImage(file);
      await updateAvatar(data);
      setNote("사진을 바꿨습니다.");
    } catch (err) {
      setNote(err.message || "사진을 저장하지 못했습니다.");
    } finally {
      setBusy("");
    }
  };

  const onNick = async (e) => {
    e.preventDefault();
    const next = nick.trim();
    if (!next) return;
    setBusy("nick");
    setNote("");
    try {
      await updateNickname(next);
      setNote("이름을 저장했습니다.");
    } catch (err) {
      setNote(err.message || "저장하지 못했습니다.");
    } finally {
      setBusy("");
    }
  };

  return (
    <main className="page mypage">
      <section className="mypage__card">
        <p className="mypage__kicker">MY PAGE</p>
        <div className="mypage__hero">
          <label className="mypage__photo">
            {user.picture ? <img src={user.picture} alt="" /> : <span>{initial}</span>}
            <input type="file" accept="image/*" onChange={onPhoto} disabled={busy === "photo"} />
            <em>{busy === "photo" ? "올리는 중" : "사진"}</em>
          </label>
          <div>
            <h1>{user.nickname || user.name}</h1>
            <p>{user.email}</p>
          </div>
        </div>

        <form className="mypage__form" onSubmit={onNick}>
          <label>
            표시 이름
            <input value={nick} maxLength={20} onChange={(e) => setNick(e.target.value)} />
          </label>
          <button type="submit" className="btn btn-accent" disabled={busy === "nick"}>
            저장
          </button>
        </form>

        <div className="mypage__row">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => updateAvatar(null).then(() => setNote("기본 사진으로 돌렸습니다."))}
          >
            사진 지우기
          </button>
          {!localMode && (
            <button type="button" className="btn btn-ghost" onClick={logout}>
              로그아웃
            </button>
          )}
        </div>
        {localMode && <p className="mypage__note">로컬 미리보기에서는 사진이 이 브라우저에만 남습니다.</p>}
        {note && <p className="mypage__note">{note}</p>}
      </section>
    </main>
  );
}
