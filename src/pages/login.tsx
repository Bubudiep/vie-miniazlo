import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Page, Button, Input, Box, Text } from 'zmp-ui';
import pb from '@/api/pocketbase';
import { normalizeUsername } from '@/utils/username';

function RequiredMark() {
  return (
    <>
      <span aria-hidden="true" className="ml-1 text-red-600">*</span>
      <span className="sr-only"> (bắt buộc)</span>
    </>
  );
}

export default function LoginPage() {
  const { loginWithPassword, register, isLoading, error, clearError, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [fullname, setFullname] = useState('');
  const [phone, setPhone] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [store, setStore] = useState('');
  const [stores, setStores] = useState<{ id: string; name: string }[]>([]);
  const [storeError, setStoreError] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    pb.send<{ id: string; name: string }[]>('/api/registration/stores', { method: 'GET' })
      .then(setStores)
      .catch(() => setStoreError(true));
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    return () => clearError();
  }, []);

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await loginWithPassword(normalizeUsername(username), password);
    } catch (err) {
      console.error('Password login failed:', err);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const approved = await register(normalizeUsername(username), password, fullname, phone, store, referralCode);
      setMode('login');
      setNotice(approved ? 'Đăng ký thành công! Bạn có thể đăng nhập ngay.' : 'Đăng ký thành công! Vui lòng chờ admin cửa hàng phê duyệt trước khi đăng nhập.');
      setUsername('');
      setPassword('');
      setFullname('');
      setPhone('');
      setReferralCode('');
      setStore('');
    } catch (err) {
      console.error('Register failed:', err);
    }
  };

  const switchMode = (newMode: 'login' | 'register') => {
    setMode(newMode);
    clearError();
    setNotice('');
    setUsername('');
    setPassword('');
    setFullname('');
    setPhone('');
    setReferralCode('');
    setStore('');
  };

  return (
    <Page className="flex flex-col items-center justify-center min-h-screen p-4 bg-gray-50">
      <Box className="w-full max-w-md bg-white rounded-lg shadow-lg p-6">
        <Text.Title className="text-center mb-6 text-2xl font-bold">
          {mode === 'register' ? 'Đăng ký tài khoản' : 'Đăng nhập'}
        </Text.Title>

        {notice && (
          <Box role="status" className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
            <Text className="text-green-700 text-sm">{notice}</Text>
          </Box>
        )}
        {error && (
          <Box role="alert" className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <Text className="text-red-600 text-sm">{error}</Text>
          </Box>
        )}

        {mode === 'login' && (
          <>
            <form noValidate onSubmit={handlePasswordLogin} className="space-y-4">
              <Box>
                <Text className="mb-2 text-sm font-medium text-gray-700">
                  Tên đăng nhập
                </Text>
                <Input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(normalizeUsername(e.target.value))}
                  placeholder="Nhập tên đăng nhập"
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  maxLength={100}
                  pattern="[A-Za-z0-9._-]+"
                  required
                  disabled={isLoading}
                  className="w-full h-11"
                />
              </Box>

              <Box>
                <Text className="mb-2 text-sm font-medium text-gray-700">
                  Mật khẩu
                </Text>
                <Input.Password
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Nhập mật khẩu"
                  required
                  disabled={isLoading}
                  visibilityToggle
                  className="w-full h-11"
                />
              </Box>

              <Button
                fullWidth
                variant="primary"
                htmlType="submit"
                disabled={isLoading}
                className="h-12 mt-6"
              >
                {isLoading ? 'Đang đăng nhập...' : 'Đăng nhập'}
              </Button>

            </form>

            <Box className="relative my-4">
              <Box className="absolute inset-0 flex items-center">
                <Box className="w-full border-t border-gray-300" />
              </Box>
              <Box className="relative flex justify-center text-sm">
                <Text className="px-4 bg-white text-gray-500">Chưa có tài khoản?</Text>
              </Box>
            </Box>

            <Button
              fullWidth
              variant="secondary"
              onClick={() => switchMode('register')}
              disabled={isLoading}
              className="h-10"
            >
              Đăng ký ngay
            </Button>
          </>
        )}

        {mode === 'register' && (
          <form noValidate onSubmit={handleRegister} className="space-y-4">
            <section className="space-y-4">
              <Text className="border-b pb-2 text-sm font-semibold text-gray-800">Tài khoản</Text>
              <Box>
              <Text className="mb-2 text-sm font-medium text-gray-700">Tên đăng nhập<RequiredMark /></Text>
                <Input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(normalizeUsername(e.target.value))}
                  placeholder="Nhập tên đăng nhập"
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  maxLength={100}
                  pattern="[A-Za-z0-9._-]+"
                  required
                  disabled={isLoading}
                  className="w-full h-11"
                />
              </Box>
              <Box>
                <Text className="mb-2 text-sm font-medium text-gray-700">Mật khẩu<RequiredMark /></Text>
                <Input.Password
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Nhập mật khẩu (tối thiểu 8 ký tự)"
                  minLength={8}
                  autoComplete="new-password"
                  required
                  disabled={isLoading}
                  visibilityToggle
                  className="w-full h-11"
                />
              </Box>
            </section>

            <section className="space-y-4 border-t pt-4">
              <Text className="border-b pb-2 text-sm font-semibold text-gray-800">Thông tin khác</Text>
              <Box>
                <Text className="mb-2 text-sm font-medium text-gray-700">Họ và tên<RequiredMark /></Text>
                <Input
                  type="text"
                  value={fullname}
                  onChange={(e) => setFullname(e.target.value)}
                  placeholder="Nhập họ và tên"
                  autoComplete="name"
                  required
                  disabled={isLoading}
                  className="w-full h-11"
                />
              </Box>
              <Box>
                <label htmlFor="register-store" className="mb-2 block text-sm font-medium text-gray-700">Cửa hàng<RequiredMark /></label>
                <select id="register-store" value={store} onChange={(e) => setStore(e.target.value)} required disabled={isLoading || storeError} className="w-full h-11 rounded-lg border px-3">
                  <option value="">Chọn cửa hàng</option>
                  {stores.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
                {storeError && <Text className="text-red-600 text-sm">Không tải được danh sách cửa hàng. Vui lòng tải lại trang.</Text>}
              </Box>
              <Box>
                <label htmlFor="register-phone" className="mb-2 block text-sm font-medium text-gray-700">Số điện thoại<RequiredMark /></label>
                <input
                  id="register-phone"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel-national"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  placeholder="Nhập 10 chữ số"
                  pattern="0[35789][0-9]{8}"
                  title="Nhập số điện thoại di động Việt Nam gồm 10 chữ số"
                  maxLength={10}
                  required
                  disabled={isLoading}
                  className="w-full h-11 rounded-lg border px-3"
                />
              </Box>
              <Box>
                <label htmlFor="register-referral" className="mb-2 block text-sm font-medium text-gray-700">Mã giới thiệu <span className="font-normal text-gray-500">(không bắt buộc)</span></label>
                <input
                  id="register-referral"
                  type="text"
                  value={referralCode}
                  onChange={(e) => setReferralCode(e.target.value.replace(/[^a-zA-Z0-9]/g, '').slice(0, 16).toUpperCase())}
                  placeholder="Nhập mã của bạn bè"
                  autoCapitalize="characters"
                  autoComplete="off"
                  spellCheck={false}
                  pattern="[A-Z0-9]{4,16}"
                  maxLength={16}
                  disabled={isLoading}
                  className="w-full h-11 rounded-lg border px-3 uppercase"
                />
              </Box>
            </section>

            <Button
              fullWidth
              variant="primary"
              htmlType="submit"
              disabled={isLoading || storeError}
              className="h-12 mt-6"
            >
              {isLoading ? 'Đang đăng ký...' : 'Đăng ký'}
            </Button>

            <Button
              fullWidth
              variant="tertiary"
              onClick={() => switchMode('login')}
              disabled={isLoading}
              className="h-10"
            >
              Đã có tài khoản? Đăng nhập
            </Button>
          </form>
        )}
      </Box>
    </Page>
  );
}
