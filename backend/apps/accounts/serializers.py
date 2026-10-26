from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.tokens import RefreshToken

User = get_user_model()


class UserDetailSerializer(serializers.ModelSerializer):
    """
    Serializer for retrieving and updating user account details.
    """
    class Meta:
        model = User
        fields = (
            'id',
            'email',
            'role',
            'timezone',
            'first_name',
            'last_name',
            'date_joined',
        )
        read_only_fields = ('id', 'role', 'date_joined')


class UserRegistrationSerializer(serializers.ModelSerializer):
    """
    Serializer for new user account registration (Customer or Provider).
    Automatically generates JWT tokens upon successful registration.
    """
    password = serializers.CharField(
        write_only=True,
        required=True,
        style={'input_type': 'password'},
        validators=[validate_password]
    )
    tokens = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = User
        fields = (
            'id',
            'email',
            'password',
            'role',
            'timezone',
            'first_name',
            'last_name',
            'tokens',
        )
        extra_kwargs = {
            'role': {'required': True},
        }

    def validate_role(self, value):
        if value not in ('customer', 'provider'):
            raise serializers.ValidationError("Role must be either 'customer' or 'provider'.")
        return value

    def create(self, validated_data):
        password = validated_data.pop('password')
        user = User.objects.create_user(password=password, **validated_data)
        return user

    def get_tokens(self, obj):
        refresh = RefreshToken.for_user(obj)
        return {
            'refresh': str(refresh),
            'access': str(refresh.access_token),
        }


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """
    Custom JWT serializer that enriches the login response payload
    with the authenticated user's profile and role.
    """
    def validate(self, attrs):
        data = super().validate(attrs)
        data['user'] = {
            'id': self.user.id,
            'email': self.user.email,
            'role': self.user.role,
            'timezone': self.user.timezone,
            'first_name': self.user.first_name,
            'last_name': self.user.last_name,
        }
        return data
