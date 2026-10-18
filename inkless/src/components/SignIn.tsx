import logo from "../assets/logo.png";
import google from "../assets/google.png";
import microsoft from "../assets/microsoft.png";
import dot from "../assets/dot.svg";
import { signInWithGoogle } from "../lib/google";

type Props = { onSignIn?: () => void };

export default function SignIn(_props: Props) {
  const comingSoon = () => alert("Coming soon");
  const signIn = () => {
    signInWithGoogle().catch((error: Error) => alert(error.message));
  };

  return (
    <div className="signin">
      <p className="signin-welcome">Welcome to</p>
      <h1 className="logo logo-large"><img src={logo} alt="inkless" /></h1>
      <p className="signin-tagline">Draw or write whatever you want, whenever you want.</p>

      <div className="signin-buttons">
        <button className="signin-google" onClick={signIn}>
          <img src={google} alt="" width={30} height={30} />
          Sign in with Google
        </button>
        <button className="signin-microsoft" onClick={comingSoon}>
          <img src={microsoft} alt="" width={21} height={21} />
          Sign in with Microsoft
        </button>
        <button className="signin-email" onClick={comingSoon}>Sign in with Email</button>
      </div>

      <p className="signin-new">New here?</p>
      <button className="signin-create" onClick={comingSoon}>Create a new account</button>

      <footer className="signin-footer">
        <a href="#">Terms and Conditions</a>
        <img src={dot} alt="" width={4} height={4} />
        <a href="#">Privacy Policy</a>
        <img src={dot} alt="" width={4} height={4} />
        <a href="#">Contact Support</a>
      </footer>
    </div>
  );
}