import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

const Index = () => {
  const { user, isAdmin, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isLoading) return;
    
    // If not logged in, go to login
    if (!user) {
      navigate('/login');
    } else if (isAdmin) {
      // If admin, go to admin panel
      navigate('/admin');
    } else {
      // If regular user/personel, go to employee panel
      navigate('/employee');
    }
  }, [user, isAdmin, isLoading, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="animate-pulse text-muted-foreground">Yükleniyor...</div>
    </div>
  );
};

export default Index;
