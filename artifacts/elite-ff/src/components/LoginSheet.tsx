import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function LoginSheet({ open, onClose }: Props) {
  const { login } = useAuth();

  useEffect(() => {
    if (open) {
      login();
      onClose();
    }
  }, [open]);

  return null;
}
