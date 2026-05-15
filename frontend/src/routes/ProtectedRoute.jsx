import { useAccount } from "wagmi";
import { Navigate } from "react-router-dom";

export default function ProtectedRoute({ children }) {
  const { address, isConnected } = useAccount();

  if (!isConnected || !address) {
    return <Navigate to="/" replace />;
  }

  return children;
}